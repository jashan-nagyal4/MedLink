/**
 * Emergency Incident Routes
 * Handles creating incidents, applying automated triage, and managing status.
 */

const express = require("express");
const db = require("../config/db");
const { deriveStandardizedRequirements } = require("../services/triageEngine");
const { rankHospitalsForIncident } = require("../services/hospitalMatcher");
const firebaseService = require("../services/firebaseService");
const socketService = require("../services/socketService");
const coordinationEngine = require("../services/coordinationEngine");
const incidentSimulator = require("../services/incidentSimulator");
const { authenticateToken, optionalAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * Incident Simulator Controls (Admin Only - Hidden & Restricted from Citizen and Hospital Roles)
 */
const requireAdminSimulator = (req, res, next) => {
  if (req.user && req.user.role !== "admin") {
    return res.status(403).json({
      error: "Access denied. Only Central Dispatch Administrators can access simulator controls."
    });
  }
  next();
};

router.get("/simulator/status", (req, res) => {
  res.json({ success: true, ...incidentSimulator.getStatus() });
});

router.post("/simulator/toggle", optionalAuth, requireAdminSimulator, (req, res) => {
  const current = incidentSimulator.getStatus();
  if (current.isRunning) {
    incidentSimulator.stop();
  } else {
    incidentSimulator.start();
  }
  res.json({ success: true, ...incidentSimulator.getStatus() });
});

router.post("/simulator/config", optionalAuth, requireAdminSimulator, (req, res) => {
  try {
    const updated = incidentSimulator.setConfig(req.body || {});
    res.json({ success: true, ...updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulator/clear-resolved", optionalAuth, requireAdminSimulator, async (req, res) => {
  try {
    const result = await incidentSimulator.clearResolvedCases();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulator/spawn", optionalAuth, requireAdminSimulator, async (req, res) => {
  try {
    const result = await incidentSimulator.spawnIncident(req.body || {});
    res.json({ success: true, message: "Simulated emergency incident spawned successfully.", ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulator/beds", optionalAuth, requireAdminSimulator, async (req, res) => {
  try {
    const result = await incidentSimulator.simulateBeds(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulator/blood", optionalAuth, requireAdminSimulator, async (req, res) => {
  try {
    const result = await incidentSimulator.simulateBlood(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/simulator/scenario", optionalAuth, requireAdminSimulator, async (req, res) => {
  try {
    const { scenario, hospitalId } = req.body || {};
    const result = await incidentSimulator.simulateScenario(scenario, { hospitalId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function generateIncidentNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${dateStr}-${suffix}`;
}

/**
 * 1. Evaluate Triage Preview (Doesn't write to DB)
 * POST /api/incidents/evaluate-triage
 */
router.post("/evaluate-triage", (req, res) => {
  try {
    const { chiefComplaint, conditionCategory, vitalSigns = {}, patient = {} } = req.body || {};

    if (!chiefComplaint || !chiefComplaint.trim()) {
      return res.status(400).json({ error: "chiefComplaint is required." });
    }

    const evaluation = deriveStandardizedRequirements({
      chiefComplaint: chiefComplaint.trim(),
      conditionCategory,
      vitalSigns,
      patient
    });

    res.json({
      success: true,
      evaluation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Create New Emergency Incident
 * POST /api/incidents
 */
router.post("/", optionalAuth, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const {
      callerName,
      callerPhone,
      patient,
      latitude,
      longitude,
      address,
      chiefComplaint,
      conditionCategory,
      vitalSigns = {},
      notes
    } = req.body || {};

    const reportedByUserId = req.user ? req.user.id : null;

    if (!chiefComplaint || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: "chiefComplaint, address, latitude, and longitude are required."
      });
    }

    // 1. Calculate medical requirements using Triage Engine
    const triage = deriveStandardizedRequirements({
      chiefComplaint: chiefComplaint.trim(),
      conditionCategory,
      vitalSigns,
      patient: patient || {}
    });

    await client.query("BEGIN");

    // 2. Insert patient record if provided
    let patientId = null;
    let patientRecord = null;
    if (patient && typeof patient === "object") {
      const pRes = await client.query(
        `INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          patient.name || "Unknown / Unidentified",
          Number.isInteger(patient.age) ? patient.age : null,
          patient.gender || "unknown",
          patient.contactNumber || null,
          patient.medicalHistory || null,
          patient.allergies || null
        ]
      );
      patientRecord = pRes.rows[0];
      patientId = patientRecord.id;
    }

    // 3. Insert emergency incident
    const incidentNumber = generateIncidentNumber();
    const incRes = await client.query(
      `INSERT INTO emergency_incidents
        (incident_number, caller_name, caller_phone, patient_id, location,
         address, severity, triage_level, chief_complaint, condition_category,
         vital_signs, status, notes, reported_by_user_id)
       VALUES
        ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
         $7, $8, $9, $10, $11, $12, 'reported', $13, $14)
       RETURNING id, incident_number, caller_name, caller_phone, patient_id,
                 address, severity, triage_level, chief_complaint, condition_category,
                 vital_signs, status, created_at, reported_by_user_id,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [
        incidentNumber,
        callerName || null,
        callerPhone || null,
        patientId,
        Number(longitude),
        Number(latitude),
        address.trim(),
        triage.severity,
        triage.triageLevel,
        chiefComplaint.trim(),
        triage.conditionCategory,
        JSON.stringify(vitalSigns || {}),
        notes || null,
        reportedByUserId
      ]
    );

    const createdIncident = incRes.rows[0];
    const incidentId = createdIncident.id;

    // 4. Insert derived requirements (equipment + beds + specialists)
    const insertedRequirements = [];

    for (const resItem of triage.requiredResources) {
      const rRes = await client.query(
        `INSERT INTO incident_resource_requirements
          (incident_id, required_resource_type, required_quantity, priority, justification)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [incidentId, resItem.requiredResourceType, resItem.requiredQuantity, resItem.priority, resItem.justification]
      );
      insertedRequirements.push(rRes.rows[0]);
    }

    for (const specItem of triage.requiredSpecialists) {
      const sRes = await client.query(
        `INSERT INTO incident_resource_requirements
          (incident_id, required_specialty, specialist_count, priority, justification)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [incidentId, specItem.requiredSpecialty, specItem.specialistCount, specItem.priority, specItem.justification]
      );
      insertedRequirements.push(sRes.rows[0]);
    }

    await client.query("COMMIT");

    // 5. Real-time Firebase & Socket.IO Sync
    firebaseService.syncIncident({
      ...createdIncident,
      patient: patientRecord,
      requirements: insertedRequirements,
      triage
    }).catch(e => console.warn("Firebase sync error:", e.message));

    // Broadcast to all connected clients via Socket.IO
    socketService.broadcastNewIncident({
      ...createdIncident,
      patient_name: patientRecord?.name,
      requirements: insertedRequirements
    });

    res.status(201).json({
      message: "Emergency incident registered successfully.",
      incident: createdIncident,
      patient: patientRecord,
      requirements: insertedRequirements,
      triageEvaluation: triage
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
});

/**
 * 3. List All Incidents
 * GET /api/incidents
 */
router.get("/", async (req, res, next) => {
  try {
    const query = `
      SELECT i.id, i.incident_number, i.caller_name, i.address,
             i.severity, i.triage_level, i.chief_complaint, i.condition_category,
             i.status, i.assigned_hospital_id, i.referring_hospital_id,
             i.transfer_reason, i.transfer_notes, i.transfer_urgency, i.created_at,
             ST_Y(i.location::geometry) AS latitude,
             ST_X(i.location::geometry) AS longitude,
             p.name AS patient_name,
             h.name AS assigned_hospital_name,
             ref_h.name AS referring_hospital_name
      FROM emergency_incidents i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
      LEFT JOIN hospitals ref_h ON i.referring_hospital_id = ref_h.id
      ORDER BY i.created_at DESC
    `;
    const result = await db.query(query);
    res.json({
      count: result.rowCount,
      incidents: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Get Incident Details by ID
 * GET /api/incidents/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const incRes = await db.query(
      `SELECT i.*, ST_Y(i.location::geometry) AS latitude, ST_X(i.location::geometry) AS longitude,
              h.name AS assigned_hospital_name,
              ref_h.name AS referring_hospital_name
       FROM emergency_incidents i
       LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
       LEFT JOIN hospitals ref_h ON i.referring_hospital_id = ref_h.id
       WHERE i.id = $1`,
      [id]
    );

    if (!incRes.rowCount) {
      return res.status(404).json({ error: "Emergency incident not found." });
    }

    const incident = incRes.rows[0];

    const [patientRes, reqsRes] = await Promise.all([
      incident.patient_id ? db.query("SELECT * FROM patients WHERE id = $1", [incident.patient_id]) : Promise.resolve({ rows: [] }),
      db.query("SELECT * FROM incident_resource_requirements WHERE incident_id = $1 ORDER BY id", [id])
    ]);

    res.json({
      incident,
      patient: patientRes.rows[0] || null,
      requirements: reqsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Update Status & Hospital Assignment
 * PATCH /api/incidents/:id/status
 * Only Hospital Managers and Administrators are permitted to change incident / ambulance status.
 */
router.patch("/:id/status", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({
        error: "Access denied. Patients cannot change incident or ambulance status. Only hospital managers and administrators can manage ambulance status."
      });
    }

    const { id } = req.params;
    const { status, assignedHospitalId, notes } = req.body || {};

    const result = await db.query(
      `UPDATE emergency_incidents
       SET status = COALESCE($1, status),
           assigned_hospital_id = COALESCE($2, assigned_hospital_id),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, assignedHospitalId, notes, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Emergency incident not found." });
    }

    firebaseService.syncIncidentStatus(id, status, { assignedHospitalId });

    // Broadcast status change via Socket.IO
    socketService.broadcastIncidentStatus(id, status, { assignedHospitalId });

    // Auto-delete case after it is done to free up database and cache space
    if (status === 'arrived' || status === 'closed' || status === 'resolved') {
      setTimeout(async () => {
        try {
          console.log(`🧹 [Incidents] Auto-purging completed incident #${id} to free up cache space`);
          await db.query(`DELETE FROM emergency_incidents WHERE id = $1`, [id]);
          socketService.broadcastIncidentDeleted(id);
        } catch (delErr) {
          console.warn('Auto-purge completed incident error:', delErr.message);
        }
      }, 4000);
    }

    res.json({
      message: "Incident status updated.",
      incident: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 5b. Auto-Resolve Incident & Purge from Cache
 * POST /api/incidents/:id/resolve
 */
router.post("/:id/resolve", optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const result = await db.query(
      `UPDATE emergency_incidents
       SET status = 'resolved',
           notes = COALESCE($1, notes),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [notes || 'Treated and clinically resolved', id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Emergency incident not found." });
    }

    const incident = result.rows[0];
    socketService.broadcastIncidentStatus(id, 'resolved', {
      assignedHospitalId: incident.assigned_hospital_id
    });

    // Auto-delete case after resolution to free up cache space
    setTimeout(async () => {
      try {
        console.log(`🧹 [Incidents] Purging resolved incident #${id} to free up cache space`);
        await db.query(`DELETE FROM emergency_incidents WHERE id = $1`, [id]);
        socketService.broadcastIncidentDeleted(id);
      } catch (delErr) {
        console.warn('Auto-purge resolved incident error:', delErr.message);
      }
    }, 2000);

    res.json({
      success: true,
      message: `Incident #${incident.incident_number} resolved successfully. Purging cache.`,
      incident
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Multi-Criteria Hospital Matching & Ranking
 * GET /api/incidents/:id/ranked-hospitals?radius=30000
 */
router.get("/:id/ranked-hospitals", async (req, res, next) => {
  try {
    const { id } = req.params;
    const radiusMeters = req.query.radius ? Number(req.query.radius) : 35000;

    const rankingResult = await rankHospitalsForIncident(id, radiusMeters);

    res.json({
      success: true,
      ...rankingResult
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. Start Automated Hospital Dispatch
 * POST /api/incidents/:id/start-dispatch
 * Arms countdown timer and emits dispatch request to Rank #1 hospital.
 */
router.post("/:id/start-dispatch", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({
        error: "Access denied. Patients cannot initiate hospital dispatch escalations."
      });
    }

    const { id } = req.params;
    const { timeoutSeconds, preferredHospitalId, radiusMeters } = req.body || {};

    const dispatchResult = await coordinationEngine.startDispatch(id, {
      timeoutSeconds,
      preferredHospitalId,
      radiusMeters
    });

    res.status(dispatchResult.success ? 200 : 400).json(dispatchResult);
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Hospital Response Endpoint
 * POST /api/incidents/:id/respond
 * Body: { hospitalId, action: 'accept' | 'reject', reason?: string }
 */
router.post("/:id/respond", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({
        error: "Access denied. Patients cannot respond to hospital emergency dispatches."
      });
    }

    const { id } = req.params;
    const { hospitalId, action, reason } = req.body || {};

    if (!hospitalId || !action) {
      return res.status(400).json({ error: "hospitalId and action ('accept' or 'reject') are required." });
    }

    const responseResult = await coordinationEngine.handleHospitalResponse(id, hospitalId, action, reason);
    res.json(responseResult);
  } catch (err) {
    next(err);
  }
});

/**
 * 9. Get Full Coordination State & Audit Logs
 * GET /api/incidents/:id/coordination
 */
router.get("/:id/coordination", async (req, res, next) => {
  try {
    const { id } = req.params;
    const state = await coordinationEngine.getCoordinationState(id);
    res.json({
      success: true,
      ...state
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 10. Cancel Active Dispatch
 * POST /api/incidents/:id/cancel-dispatch
 */
router.post("/:id/cancel-dispatch", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({
        error: "Access denied. Patients cannot cancel active hospital dispatches."
      });
    }

    const { id } = req.params;
    const { reason } = req.body || {};
    const result = await coordinationEngine.cancelDispatch(id, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 11. Get Incidents Filed by Current User (Patient Portal)
 * GET /api/incidents/my-incidents
 */
router.get("/user/my-incidents", authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT i.id, i.incident_number, i.caller_name, i.address,
             i.severity, i.triage_level, i.chief_complaint, i.condition_category,
             i.status, i.assigned_hospital_id, i.created_at,
             ST_Y(i.location::geometry) AS latitude,
             ST_X(i.location::geometry) AS longitude,
             p.name AS patient_name,
             h.name AS assigned_hospital_name
      FROM emergency_incidents i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
      WHERE i.reported_by_user_id = $1
      ORDER BY i.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);
    res.json({
      count: result.rowCount,
      incidents: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 12. Get Incidents Relevant to a Specific Hospital (Hospital Manager Portal)
 * GET /api/incidents/facility/:hospitalId
 */
router.get("/facility/:hospitalId", authenticateToken, async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    const query = `
      SELECT i.id, i.incident_number, i.caller_name, i.address,
             i.severity, i.triage_level, i.chief_complaint, i.condition_category,
             i.status, i.assigned_hospital_id, i.current_dispatch_hospital_id,
             i.referring_hospital_id, i.transfer_reason, i.transfer_notes, i.transfer_urgency,
             i.created_at,
             ST_Y(i.location::geometry) AS latitude,
             ST_X(i.location::geometry) AS longitude,
             p.name AS patient_name,
             p.age AS patient_age,
             p.gender AS patient_gender,
             p.medical_history,
             p.allergies,
             h.name AS assigned_hospital_name,
             ref_h.name AS referring_hospital_name
      FROM emergency_incidents i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
      LEFT JOIN hospitals ref_h ON i.referring_hospital_id = ref_h.id
      WHERE i.assigned_hospital_id = $1
         OR i.current_dispatch_hospital_id = $1
         OR i.referring_hospital_id = $1
      ORDER BY i.created_at DESC
    `;
    const result = await db.query(query, [hospitalId]);
    res.json({
      count: result.rowCount,
      incidents: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 13. Delete Emergency Incident
 * DELETE /api/incidents/:id
 * Allows Hospital Managers and Administrators to delete any incident.
 * Patients are blocked with 403 Forbidden.
 */
router.delete("/:id", optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user && req.user.role === "patient") {
      return res.status(403).json({
        error: "Access denied. Patients cannot delete emergency incidents. Only hospital managers and administrators can delete incidents."
      });
    }

    const delRes = await db.query(
      `DELETE FROM emergency_incidents WHERE id = $1 RETURNING id, incident_number`,
      [id]
    );

    if (!delRes.rowCount) {
      return res.status(404).json({ error: `Emergency incident #${id} not found.` });
    }

    const deleted = delRes.rows[0];

    // Real-time broadcast to all clients via Socket.IO
    socketService.broadcastIncidentDeleted(id);

    res.json({
      success: true,
      message: `Emergency incident #${deleted.incident_number} deleted successfully.`,
      deletedIncidentId: Number(id)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
