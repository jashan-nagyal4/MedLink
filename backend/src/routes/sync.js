/**
 * MedLink Offline-First Synchronization & Conflict Resolution Router
 * 
 * Endpoints:
 * 1. GET /api/sync/delta?since=<timestamp>
 *    - Pulls incremental records (hospitals, incidents, resources, specialists) updated since last sync.
 * 2. POST /api/sync/batch
 *    - Pushes a queue of operations created while the client was disconnected.
 *    - Resolves concurrency and state machine conflicts (Last-Write-Wins, Acuity Precedence, Bound Clamping).
 * 3. GET /api/sync/status
 *    - Returns server sync heartbeat, timestamp, and metadata.
 */

const express = require('express');
const db = require('../config/db');
const { deriveStandardizedRequirements } = require('../services/triageEngine');
const socketService = require('../services/socketService');
const firebaseService = require('../services/firebaseService');

const router = express.Router();

/**
 * 1. Sync Status & Heartbeat
 * GET /api/sync/status
 */
router.get('/status', async (req, res, next) => {
  try {
    const serverTime = new Date().toISOString();
    const countRes = await db.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM emergency_incidents) AS total_incidents,
        (SELECT COUNT(*)::int FROM hospitals) AS total_hospitals
    `);

    res.json({
      success: true,
      service: 'MedLink Data Synchronization Engine',
      serverTime,
      stats: countRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Incremental Delta Pull
 * GET /api/sync/delta?since=<ISO_TIMESTAMP>
 */
router.get('/delta', async (req, res, next) => {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(0);

    const [incidentsRes, hospitalsRes, resourcesRes, specialistsRes] = await Promise.all([
      // Modified incidents
      db.query(
        `SELECT i.*, 
                ST_Y(i.location::geometry) AS latitude, 
                ST_X(i.location::geometry) AS longitude,
                p.name AS patient_name,
                h.name AS assigned_hospital_name
         FROM emergency_incidents i
         LEFT JOIN patients p ON i.patient_id = p.id
         LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
         WHERE i.updated_at >= $1
         ORDER BY i.updated_at ASC`,
        [sinceDate]
      ),
      // Modified hospitals
      db.query(
        `SELECT * FROM hospitals WHERE updated_at >= $1 ORDER BY updated_at ASC`,
        [sinceDate]
      ),
      // Modified hospital resources
      db.query(
        `SELECT * FROM hospital_resources WHERE updated_at >= $1 ORDER BY updated_at ASC`,
        [sinceDate]
      ),
      // Modified specialists
      db.query(
        `SELECT * FROM hospital_specialists WHERE updated_at >= $1 ORDER BY updated_at ASC`,
        [sinceDate]
      )
    ]);

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      since: sinceDate.toISOString(),
      changes: {
        incidents: incidentsRes.rows,
        hospitals: hospitalsRes.rows,
        resources: resourcesRes.rows,
        specialists: specialistsRes.rows
      },
      counts: {
        incidents: incidentsRes.rowCount,
        hospitals: hospitalsRes.rowCount,
        resources: resourcesRes.rowCount,
        specialists: specialistsRes.rowCount
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Batch Outbox Push & Conflict Resolution
 * POST /api/sync/batch
 */
router.post('/batch', async (req, res, next) => {
  const { clientId, operations = [] } = req.body || {};

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'operations must be a non-empty array of offline actions.' });
  }

  const results = [];
  const client = await db.pool.connect();

  try {
    for (const op of operations) {
      const { clientOpId, action, payload, clientTimestamp } = op;

      try {
        await client.query('BEGIN');

        if (action === 'CREATE_INCIDENT') {
          // --- CONFLICT RESOLUTION: CREATE INCIDENT ---
          // Creates patient + emergency incident + standardized resource requirements
          const {
            callerName,
            callerPhone,
            patientName,
            patientAge,
            patientGender,
            medicalHistory,
            allergies,
            address,
            lat,
            lng,
            chiefComplaint,
            conditionCategory,
            vitalSigns = {},
            notes
          } = payload || {};

          // 1. Insert patient
          const patRes = await client.query(
            `INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name`,
            [patientName || 'Emergency Patient', patientAge || 30, patientGender || 'other', callerPhone, medicalHistory, allergies]
          );
          const patientId = patRes.rows[0].id;

          // 2. Derive triage requirements
          const triage = deriveStandardizedRequirements({
            chiefComplaint,
            conditionCategory,
            vitalSigns,
            patient: { name: patientName, age: patientAge, gender: patientGender }
          });

          // 3. Generate Incident Number
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const incidentNumber = `OFF-${dateStr}-${suffix}`;

          const incRes = await client.query(
            `INSERT INTO emergency_incidents
              (incident_number, caller_name, caller_phone, patient_id, location,
               address, severity, triage_level, chief_complaint, condition_category,
               vital_signs, status, notes, created_at, updated_at)
             VALUES
              ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
               $7, $8, $9, $10, $11, $12, 'reported', $13, $14, NOW())
             RETURNING id, incident_number, status, created_at`,
            [
              incidentNumber,
              callerName || 'Offline Caller',
              callerPhone || 'Unknown',
              patientId,
              Number(lng) || 74.8570,
              Number(lat) || 32.7266,
              address || 'Offline Recorded Location, Jammu',
              triage.severity,
              triage.triageLevel,
              chiefComplaint,
              triage.conditionCategory,
              JSON.stringify(vitalSigns),
              notes ? `[Offline Synced] ${notes}` : '[Offline Synced]',
              clientTimestamp ? new Date(clientTimestamp) : new Date()
            ]
          );

          const newInc = incRes.rows[0];

          await client.query('COMMIT');

          // Broadcast new incident to active WebSocket clients
          socketService.broadcastNewIncident({
            ...newInc,
            patient_name: patientName,
            address,
            chief_complaint: chiefComplaint,
            severity: triage.severity
          });

          results.push({
            clientOpId,
            action,
            status: 'applied',
            serverIncidentId: newInc.id,
            incidentNumber: newInc.incident_number,
            message: 'Offline incident registered and triage evaluated successfully.'
          });

        } else if (action === 'UPDATE_STATUS') {
          // --- CONFLICT RESOLUTION: INCIDENT STATUS UPDATE ---
          // Rule: Terminal Acuity & Lifecycle Precedence
          // FSM priority: reported (0) < requested (1) < assigned (2) < en_route (3) < arrived (4) < closed (5)
          const STATUS_ORDER = {
            reported: 0,
            assessing: 1,
            dispatching: 1,
            requested: 2,
            assigned: 3,
            en_route: 4,
            arrived: 5,
            closed: 6,
            resolved: 6,
            cancelled: 6
          };

          const { incidentId, status: clientStatus, notes, assignedHospitalId } = payload || {};
          const currentRes = await client.query(
            `SELECT id, incident_number, status, updated_at FROM emergency_incidents WHERE id = $1 FOR UPDATE`,
            [incidentId]
          );

          if (!currentRes.rowCount) {
            await client.query('ROLLBACK');
            results.push({
              clientOpId,
              action,
              status: 'rejected',
              reason: `Incident #${incidentId} does not exist on server.`
            });
            continue;
          }

          const current = currentRes.rows[0];
          const serverRank = STATUS_ORDER[current.status] !== undefined ? STATUS_ORDER[current.status] : 0;
          const clientRank = STATUS_ORDER[clientStatus] !== undefined ? STATUS_ORDER[clientStatus] : 0;

          // Conflict check: if server has progressed further than client's stale update
          if (serverRank > clientRank) {
            await client.query('ROLLBACK');
            results.push({
              clientOpId,
              action,
              status: 'conflict_resolved',
              resolution: 'server_terminal_precedence',
              currentStatus: current.status,
              message: `Server already progressed to '${current.status}' (rank ${serverRank}), ignoring stale client update to '${clientStatus}' (rank ${clientRank}).`
            });
            continue;
          }

          // Otherwise apply update
          await client.query(
            `UPDATE emergency_incidents
             SET status = $1,
                 assigned_hospital_id = COALESCE($2, assigned_hospital_id),
                 notes = COALESCE($3, notes),
                 updated_at = NOW()
             WHERE id = $4`,
            [clientStatus, assignedHospitalId || null, notes ? `[Synced] ${notes}` : null, incidentId]
          );

          await client.query('COMMIT');

          socketService.broadcastIncidentStatus(incidentId, clientStatus, { assignedHospitalId });

          results.push({
            clientOpId,
            action,
            status: 'applied',
            incidentId,
            newStatus: clientStatus,
            message: `Incident status updated to '${clientStatus}'.`
          });

        } else if (action === 'UPDATE_RESOURCE') {
          // --- CONFLICT RESOLUTION: RESOURCE CAPACITY UPDATE ---
          // Rule: Atomic Bounds Clamping
          const { resourceId, availableQuantity } = payload || {};
          const resQuery = await client.query(
            `SELECT id, hospital_id, resource_type, total_quantity, available_quantity 
             FROM hospital_resources WHERE id = $1 FOR UPDATE`,
            [resourceId]
          );

          if (!resQuery.rowCount) {
            await client.query('ROLLBACK');
            results.push({
              clientOpId,
              action,
              status: 'rejected',
              reason: `Resource #${resourceId} does not exist.`
            });
            continue;
          }

          const currentRes = resQuery.rows[0];
          const total = currentRes.total_quantity;
          let clampedAvail = Math.max(0, Math.min(total, Number(availableQuantity)));
          const wasAdjusted = clampedAvail !== Number(availableQuantity);

          await client.query(
            `UPDATE hospital_resources
             SET available_quantity = $1,
                 status = CASE WHEN $1 = 0 THEN 'unavailable' ELSE 'available' END,
                 updated_at = NOW()
             WHERE id = $2`,
            [clampedAvail, resourceId]
          );

          await client.query('COMMIT');

          results.push({
            clientOpId,
            action,
            status: wasAdjusted ? 'conflict_resolved' : 'applied',
            resolution: wasAdjusted ? 'bounds_clamped' : undefined,
            resourceId,
            reconciledQuantity: clampedAvail,
            message: wasAdjusted 
              ? `Requested ${availableQuantity} clamped to capacity bounds [0, ${total}].`
              : `Resource #${resourceId} available quantity set to ${clampedAvail}.`
          });

        } else {
          await client.query('ROLLBACK');
          results.push({
            clientOpId,
            action,
            status: 'rejected',
            reason: `Unsupported offline operation action: '${action}'.`
          });
        }

      } catch (opErr) {
        await client.query('ROLLBACK');
        results.push({
          clientOpId,
          action,
          status: 'error',
          error: opErr.message
        });
      }
    }

    res.json({
      success: true,
      clientId,
      processedCount: results.length,
      serverTime: new Date().toISOString(),
      results
    });

  } finally {
    client.release();
  }
});

module.exports = router;
