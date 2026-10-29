/**
 * Finite State Machine (FSM) Incident Coordination & Escalation Engine
 * 
 * 1. Finite State Machine for emergency dispatch lifecycle:
 *    REPORTED -> REQUESTED -> (ACCEPTED | REJECTED | TIMED_OUT) -> ESCALATED -> (REQUESTED ... | EXHAUSTED)
 * 2. Real-time Socket.IO dispatch request broadcast to targeted hospital room + dashboard.
 * 3. Configurable timeout countdown timer with automatic escalation.
 * 4. Hospital acceptance & rejection handling with persistent audit trail in incident_dispatch_logs.
 */

const db = require("../config/db");
const { rankHospitalsForIncident } = require("./hospitalMatcher");
const socketService = require("./socketService");

// In-memory active dispatch timers registry:
// Map<incidentId, { timerId, incidentId, hospitalId, hospitalName, rankPosition, timeoutSeconds, requestedAt, expiresAt, dispatchLogId }>
const activeTimers = new Map();

/**
 * Helper to safely clear active timer for an incident
 */
function clearIncidentTimer(incidentId) {
  const id = Number(incidentId);
  const active = activeTimers.get(id);
  if (active && active.timerId) {
    clearTimeout(active.timerId);
    activeTimers.delete(id);
    return true;
  }
  return false;
}

/**
 * 1. Start Dispatch to the Best Ranked Hospital
 * Transitions FSM to 'requested' and arms timeout countdown.
 */
async function startDispatch(incidentId, options = {}) {
  const id = Number(incidentId);
  const timeoutSeconds = Number(options.timeoutSeconds) || 45;
  const radiusMeters = Number(options.radiusMeters) || 35000;
  const preferredHospitalId = options.preferredHospitalId ? Number(options.preferredHospitalId) : null;

  // 1. Fetch current incident
  const incRes = await db.query(
    `SELECT i.*, p.name AS patient_name, p.age AS patient_age, p.gender AS patient_gender
     FROM emergency_incidents i
     LEFT JOIN patients p ON i.patient_id = p.id
     WHERE i.id = $1`,
    [id]
  );

  if (!incRes.rowCount) {
    throw new Error(`Emergency incident #${id} not found.`);
  }

  const incident = incRes.rows[0];

  // Prevent dispatching already completed/cancelled incidents
  if (["assigned", "en_route", "arrived", "closed", "cancelled"].includes(incident.status)) {
    throw new Error(`Cannot dispatch incident #${id} with status '${incident.status}'.`);
  }

  // 2. Fetch all previous dispatch attempts for this incident
  const logsRes = await db.query(
    `SELECT hospital_id, status FROM incident_dispatch_logs WHERE incident_id = $1`,
    [id]
  );

  const contactedHospitalIds = new Set(
    logsRes.rows
      .filter((l) => ["rejected", "timed_out", "cancelled"].includes(l.status))
      .map((l) => Number(l.hospital_id))
  );

  // 3. Fetch ranked hospitals using Multi-Criteria Matcher
  const rankingResult = await rankHospitalsForIncident(id, radiusMeters);
  const allRanked = (rankingResult.rankedHospitals || []).map((h) => ({
    ...h,
    id: Number(h.hospitalId || h.id),
    finalScore: h.compositeScore !== undefined ? h.compositeScore : (h.finalScore || 0),
    travelTimeMinutes: h.estimatedTravelMinutes !== undefined ? h.estimatedTravelMinutes : (h.travelTimeMinutes || 0)
  }));

  if (allRanked.length === 0) {
    await markIncidentExhausted(id, "No receiving hospitals found within search radius.");
    return {
      success: false,
      status: "exhausted",
      message: "No receiving hospitals found within search radius."
    };
  }

  // 4. Select candidate hospital
  let targetHospital = null;
  let rankPosition = 1;

  if (preferredHospitalId) {
    const preferred = allRanked.find((h) => Number(h.id) === preferredHospitalId);
    if (preferred && !contactedHospitalIds.has(preferredHospitalId)) {
      targetHospital = preferred;
      rankPosition = allRanked.indexOf(preferred) + 1;
    }
  }

  if (!targetHospital) {
    // Pick the highest-ranked hospital that has not yet declined or timed out
    const available = allRanked.filter((h) => !contactedHospitalIds.has(Number(h.id)));
    if (available.length === 0) {
      await markIncidentExhausted(id, `All ${allRanked.length} ranked hospitals have declined or timed out.`);
      return {
        success: false,
        status: "exhausted",
        message: "All ranked hospitals have declined or timed out.",
        attemptedCount: contactedHospitalIds.size
      };
    }
    targetHospital = available[0];
    rankPosition = allRanked.indexOf(targetHospital) + 1;
  }

  // 5. Clear any prior in-memory timer
  clearIncidentTimer(id);

  const requestedAt = new Date();
  const expiresAt = new Date(requestedAt.getTime() + timeoutSeconds * 1000);

  // 6. Insert new dispatch log
  const logInsertRes = await db.query(
    `INSERT INTO incident_dispatch_logs
      (incident_id, hospital_id, rank_position, match_score, distance_km,
       travel_time_minutes, status, timeout_seconds, requested_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
     RETURNING *`,
    [
      id,
      targetHospital.id,
      rankPosition,
      targetHospital.finalScore,
      targetHospital.distanceKm,
      targetHospital.travelTimeMinutes,
      timeoutSeconds,
      requestedAt,
      expiresAt
    ]
  );
  const dispatchLog = logInsertRes.rows[0];

  // 7. Update incident status to 'requested'
  await db.query(
    `UPDATE emergency_incidents
     SET status = 'requested',
         current_dispatch_hospital_id = $1,
         escalation_level = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [targetHospital.id, rankPosition - 1, id]
  );

  // 8. Arm in-memory timeout countdown
  const timerId = setTimeout(() => {
    handleTimeout(id, targetHospital.id, rankPosition).catch((err) =>
      console.error(`❌ [CoordinationEngine] Timeout handler failed for incident #${id}:`, err.message)
    );
  }, timeoutSeconds * 1000);

  activeTimers.set(id, {
    timerId,
    incidentId: id,
    hospitalId: targetHospital.id,
    hospitalName: targetHospital.name,
    rankPosition,
    timeoutSeconds,
    requestedAt,
    expiresAt,
    dispatchLogId: dispatchLog.id
  });

  // 9. Fetch incident requirements to enrich Socket.IO broadcast payload
  const reqsRes = await db.query(
    `SELECT required_resource_type, required_quantity, required_specialty, specialist_count, priority, justification
     FROM incident_resource_requirements
     WHERE incident_id = $1`,
    [id]
  );

  const dispatchPayload = {
    incidentId: id,
    incidentNumber: incident.incident_number,
    dispatchLogId: dispatchLog.id,
    targetHospitalId: targetHospital.id,
    targetHospitalName: targetHospital.name,
    rankPosition,
    matchScore: targetHospital.finalScore,
    distanceKm: targetHospital.distanceKm,
    travelTimeMinutes: targetHospital.travelTimeMinutes,
    severity: incident.severity,
    triageLevel: incident.triageLevel || incident.triage_level,
    chiefComplaint: incident.chief_complaint,
    conditionCategory: incident.condition_category,
    patient: {
      name: incident.patient_name,
      age: incident.patient_age,
      gender: incident.patient_gender
    },
    requirements: reqsRes.rows,
    timeoutSeconds,
    requestedAt: requestedAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  // 10. Real-time broadcast to targeted hospital room AND dispatcher dashboard
  socketService.broadcastDispatchRequest(dispatchPayload);
  socketService.broadcastIncidentStatus(id, "requested", {
    targetHospitalId: targetHospital.id,
    targetHospitalName: targetHospital.name,
    rankPosition,
    expiresAt: expiresAt.toISOString(),
    timeoutSeconds
  });

  return {
    success: true,
    status: "requested",
    dispatchLog,
    targetHospital,
    rankPosition,
    expiresAt: expiresAt.toISOString(),
    timeoutSeconds
  };
}

/**
 * 2. Handle Hospital Response (Accept or Reject)
 */
async function handleHospitalResponse(incidentId, hospitalId, action, reason = null) {
  const incId = Number(incidentId);
  const hospId = Number(hospitalId);
  const act = String(action).toLowerCase();

  if (!["accept", "reject"].includes(act)) {
    throw new Error(`Invalid response action '${action}'. Must be 'accept' or 'reject'.`);
  }

  // 1. Verify pending dispatch log
  const logRes = await db.query(
    `SELECT l.*, h.name AS hospital_name
     FROM incident_dispatch_logs l
     JOIN hospitals h ON l.hospital_id = h.id
     WHERE l.incident_id = $1 AND l.hospital_id = $2 AND l.status = 'pending'
     ORDER BY l.requested_at DESC
     LIMIT 1`,
    [incId, hospId]
  );

  if (!logRes.rowCount) {
    throw new Error(`No active pending dispatch request found for incident #${incId} and hospital #${hospId}.`);
  }

  const activeLog = logRes.rows[0];

  // 2. Clear timer immediately
  clearIncidentTimer(incId);

  if (act === "accept") {
    // Update dispatch log to 'accepted'
    await db.query(
      `UPDATE incident_dispatch_logs
       SET status = 'accepted', responded_at = NOW(), response_reason = $1
       WHERE id = $2`,
      [reason || "Accepted by hospital triage coordinator", activeLog.id]
    );

    // Update emergency_incidents to 'assigned'
    const updatedInc = await db.query(
      `UPDATE emergency_incidents
       SET status = 'assigned',
           assigned_hospital_id = $1,
           current_dispatch_hospital_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [hospId, incId]
    );

    const payload = {
      incidentId: incId,
      hospitalId: hospId,
      hospitalName: activeLog.hospital_name,
      rankPosition: activeLog.rank_position,
      notes: reason
    };

    // Broadcast acceptance
    socketService.broadcastHospitalAccepted(payload);
    socketService.broadcastIncidentStatus(incId, "assigned", {
      assignedHospitalId: hospId,
      assignedHospitalName: activeLog.hospital_name
    });

    return {
      success: true,
      action: "accept",
      status: "assigned",
      incident: updatedInc.rows[0],
      assignedHospital: {
        id: hospId,
        name: activeLog.hospital_name
      }
    };
  }

  if (act === "reject") {
    const rejectReason = reason || "Capacity / Specialist currently unavailable";

    // Update dispatch log to 'rejected'
    await db.query(
      `UPDATE incident_dispatch_logs
       SET status = 'rejected', responded_at = NOW(), response_reason = $1
       WHERE id = $2`,
      [rejectReason, activeLog.id]
    );

    // Update emergency incident to 'rejected'
    await db.query(
      `UPDATE emergency_incidents
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1`,
      [incId]
    );

    const payload = {
      incidentId: incId,
      hospitalId: hospId,
      hospitalName: activeLog.hospital_name,
      rankPosition: activeLog.rank_position,
      reason: rejectReason
    };

    socketService.broadcastHospitalRejected(payload);

    // Trigger immediate automatic escalation to the next ranked hospital
    const escalationResult = await escalateIncident(incId, {
      trigger: "rejected",
      previousHospitalId: hospId,
      previousHospitalName: activeLog.hospital_name,
      previousRank: activeLog.rank_position,
      reason: rejectReason,
      timeoutSeconds: activeLog.timeout_seconds
    });

    return {
      success: true,
      action: "reject",
      status: "escalated",
      previousHospital: {
        id: hospId,
        name: activeLog.hospital_name
      },
      reason: rejectReason,
      escalation: escalationResult
    };
  }
}

/**
 * 3. Handle Timeout Expiry
 * Transitions log to 'timed_out' and triggers automated escalation.
 */
async function handleTimeout(incidentId, hospitalId, rankPosition) {
  const incId = Number(incidentId);
  const hospId = Number(hospitalId);

  // Clear in-memory timer
  clearIncidentTimer(incId);

  // Check if still pending in DB
  const updateRes = await db.query(
    `UPDATE incident_dispatch_logs
     SET status = 'timed_out', responded_at = NOW(), response_reason = 'Hospital acknowledgement timeout reached'
     WHERE incident_id = $1 AND hospital_id = $2 AND status = 'pending'
     RETURNING *`,
    [incId, hospId]
  );

  if (!updateRes.rowCount) {
    // Already responded to or cancelled
    return null;
  }

  const timedOutLog = updateRes.rows[0];

  // Update incident status to 'timed_out'
  await db.query(
    `UPDATE emergency_incidents
     SET status = 'timed_out', updated_at = NOW()
     WHERE id = $1`,
    [incId]
  );

  // Get hospital name
  const hospRes = await db.query(`SELECT name FROM hospitals WHERE id = $1`, [hospId]);
  const hospitalName = hospRes.rows[0]?.name || `Hospital #${hospId}`;

  socketService.broadcastDispatchTimeout({
    incidentId: incId,
    hospitalId: hospId,
    hospitalName,
    rankPosition,
    timeoutSeconds: timedOutLog.timeout_seconds
  });

  // Automatically escalate to next hospital
  const escalationResult = await escalateIncident(incId, {
    trigger: "timed_out",
    previousHospitalId: hospId,
    previousHospitalName: hospitalName,
    previousRank: rankPosition,
    reason: `Response timeout after ${timedOutLog.timeout_seconds} seconds`,
    timeoutSeconds: timedOutLog.timeout_seconds
  });

  return escalationResult;
}

/**
 * 4. Escalate Incident to Next Ranked Hospital
 */
async function escalateIncident(incidentId, details = {}) {
  const incId = Number(incidentId);

  console.log(`⚡ [CoordinationEngine] Escalating incident #${incId}. Trigger: ${details.trigger || "manual"}`);

  // Update status to 'escalated'
  await db.query(
    `UPDATE emergency_incidents
     SET status = 'escalated', updated_at = NOW()
     WHERE id = $1`,
    [incId]
  );

  socketService.broadcastIncidentStatus(incId, "escalated", details);

  // Re-run dispatch to pick next ranked hospital
  const nextDispatch = await startDispatch(incId, {
    timeoutSeconds: details.timeoutSeconds || 45
  });

  if (nextDispatch.success) {
    socketService.broadcastIncidentEscalated({
      incidentId: incId,
      previousHospitalId: details.previousHospitalId,
      previousHospitalName: details.previousHospitalName,
      previousRank: details.previousRank,
      newHospitalId: nextDispatch.targetHospital.id,
      newHospitalName: nextDispatch.targetHospital.name,
      newRank: nextDispatch.rankPosition,
      matchScore: nextDispatch.targetHospital.finalScore,
      timeoutSeconds: nextDispatch.timeoutSeconds
    });
  }

  return nextDispatch;
}

/**
 * 5. Mark Incident Exhausted (Supervisor Alert)
 */
async function markIncidentExhausted(incidentId, reason) {
  const incId = Number(incidentId);
  clearIncidentTimer(incId);

  await db.query(
    `UPDATE emergency_incidents
     SET status = 'exhausted', current_dispatch_hospital_id = NULL, updated_at = NOW()
     WHERE id = $1`,
    [incId]
  );

  socketService.broadcastIncidentExhausted({
    incidentId: incId,
    status: "exhausted",
    reason,
    timestamp: new Date().toISOString()
  });

  socketService.broadcastIncidentStatus(incId, "exhausted", { reason });
}

/**
 * 6. Get Comprehensive Coordination State
 * Provides full audit history, active timer countdown, and ranked hospital list.
 */
async function getCoordinationState(incidentId) {
  const id = Number(incidentId);

  const [incRes, logsRes] = await Promise.all([
    db.query(
      `SELECT i.*, p.name AS patient_name, p.age AS patient_age, p.gender AS patient_gender,
              h.name AS assigned_hospital_name,
              cur.name AS current_dispatch_hospital_name
       FROM emergency_incidents i
       LEFT JOIN patients p ON i.patient_id = p.id
       LEFT JOIN hospitals h ON i.assigned_hospital_id = h.id
       LEFT JOIN hospitals cur ON i.current_dispatch_hospital_id = cur.id
       WHERE i.id = $1`,
      [id]
    ),
    db.query(
      `SELECT l.*, h.name AS hospital_name, h.address AS hospital_address
       FROM incident_dispatch_logs l
       JOIN hospitals h ON l.hospital_id = h.id
       WHERE l.incident_id = $1
       ORDER BY l.requested_at ASC`,
      [id]
    )
  ]);

  if (!incRes.rowCount) {
    throw new Error(`Incident #${id} not found.`);
  }

  const incident = incRes.rows[0];
  const logs = logsRes.rows;

  // Active timer calculation
  const activeTimer = activeTimers.get(id);
  let timerState = null;
  if (activeTimer) {
    const msRemaining = activeTimer.expiresAt.getTime() - Date.now();
    const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000));
    timerState = {
      isActive: secondsRemaining > 0,
      hospitalId: activeTimer.hospitalId,
      hospitalName: activeTimer.hospitalName,
      rankPosition: activeTimer.rankPosition,
      timeoutSeconds: activeTimer.timeoutSeconds,
      requestedAt: activeTimer.requestedAt.toISOString(),
      expiresAt: activeTimer.expiresAt.toISOString(),
      secondsRemaining
    };
  }

  // Get ranked hospitals and annotate each with coordination status
  let rankedHospitals = [];
  try {
    const ranking = await rankHospitalsForIncident(id);
    const logStatusMap = new Map();
    for (const log of logs) {
      logStatusMap.set(Number(log.hospital_id), log);
    }

    rankedHospitals = (ranking.rankedHospitals || []).map((h, idx) => {
      const hospitalId = Number(h.hospitalId || h.id);
      const log = logStatusMap.get(hospitalId);
      let dispatchStatus = "queued"; // default waiting in line

      if (log) {
        dispatchStatus = log.status; // 'pending', 'accepted', 'rejected', 'timed_out'
      } else if (Number(incident.assigned_hospital_id) === hospitalId) {
        dispatchStatus = "accepted";
      }

      return {
        ...h,
        id: hospitalId,
        rank: idx + 1,
        dispatchStatus,
        lastContactedAt: log ? log.requested_at : null,
        respondedAt: log ? log.responded_at : null,
        responseReason: log ? log.response_reason : null
      };
    });
  } catch (err) {
    console.warn("⚠️ Error ranking hospitals for coordination state:", err.message);
  }

  return {
    incident,
    timer: timerState,
    logs,
    rankedHospitals,
    escalationLevel: incident.escalation_level
  };
}

/**
 * 7. Cancel Active Dispatch
 */
async function cancelDispatch(incidentId, reason = "Cancelled by dispatcher") {
  const id = Number(incidentId);
  clearIncidentTimer(id);

  await db.query(
    `UPDATE incident_dispatch_logs
     SET status = 'cancelled', responded_at = NOW(), response_reason = $1
     WHERE incident_id = $2 AND status = 'pending'`,
    [reason, id]
  );

  const updated = await db.query(
    `UPDATE emergency_incidents
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  socketService.broadcastIncidentStatus(id, "cancelled", { reason });

  return {
    success: true,
    message: "Dispatch cancelled.",
    incident: updated.rows[0]
  };
}

// Register WebSocket listener with socketService
socketService.setHospitalResponseHandler(async (data) => {
  const { incidentId, hospitalId, action, reason } = data || {};
  return handleHospitalResponse(incidentId, hospitalId, action, reason);
});

module.exports = {
  startDispatch,
  handleHospitalResponse,
  handleTimeout,
  escalateIncident,
  getCoordinationState,
  cancelDispatch,
  clearIncidentTimer,
  activeTimers
};
