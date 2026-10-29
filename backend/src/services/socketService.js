/**
 * MedLink Socket.IO Real-time Communication Service
 * 
 * 1. Real-time WebSockets with room support (`hospital_${id}`).
 * 2. Event emission for incident creation, status changes, and hospital inventory.
 * 3. Finite State Machine (FSM) event coordination:
 *    - `incident:dispatch_request` (targeted to hospital room & global dashboard)
 *    - `incident:respond` (WebSocket action from hospital accept/reject)
 *    - `incident:accepted`
 *    - `incident:rejected`
 *    - `incident:timed_out`
 *    - `incident:escalated`
 *    - `incident:exhausted`
 */

const { Server } = require("socket.io");

let io = null;
// Pluggable handler for WebSocket responses to avoid circular imports
let hospitalResponseHandler = null;

function setHospitalResponseHandler(handler) {
  hospitalResponseHandler = handler;
}

function init(httpServer) {
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
  const originConfig = corsOrigin === "*"
    ? true
    : corsOrigin.includes(",")
      ? corsOrigin.split(",").map(s => s.trim())
      : corsOrigin;

  io = new Server(httpServer, {
    cors: {
      origin: originConfig,
      methods: ["GET", "POST", "PATCH"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

    // Join hospital-specific room for targeted dispatches
    socket.on("hospital:join", (hospitalId) => {
      const room = `hospital_${hospitalId}`;
      socket.join(room);
      console.log(`🏥 [Socket.IO] Socket ${socket.id} joined room: ${room}`);
    });

    // Leave hospital room if needed
    socket.on("hospital:leave", (hospitalId) => {
      const room = `hospital_${hospitalId}`;
      socket.leave(room);
      console.log(`🏥 [Socket.IO] Socket ${socket.id} left room: ${room}`);
    });

    // Hospital responding to dispatch request via WebSocket
    socket.on("incident:respond", async (data, ackCallback) => {
      console.log(`📥 [Socket.IO] Hospital response received via WS:`, data);
      try {
        if (typeof hospitalResponseHandler === "function") {
          const result = await hospitalResponseHandler(data);
          if (typeof ackCallback === "function") {
            ackCallback({ success: true, result });
          }
        } else {
          console.warn("⚠️ [Socket.IO] No hospital response handler registered.");
          if (typeof ackCallback === "function") {
            ackCallback({ success: false, error: "Handler not registered" });
          }
        }
      } catch (err) {
        console.error("❌ [Socket.IO] Error handling incident:respond:", err.message);
        if (typeof ackCallback === "function") {
          ackCallback({ success: false, error: err.message });
        }
      }
    });

    // Listen for simple acknowledgements
    socket.on("incident:acknowledge", (data) => {
      console.log(`✅ [Socket.IO] Incident acknowledged:`, data);
      io.emit("incident:acknowledged", {
        ...data,
        acknowledgedAt: new Date().toISOString()
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Socket.IO server initialized and listening for WebSocket connections.");
  return io;
}

function getIO() {
  return io;
}

/** Broadcast newly created emergency incident to all connected clients */
function broadcastNewIncident(incident) {
  if (!io) return;
  console.log(`📡 [Socket.IO] Broadcasting new incident #${incident.incident_number || incident.id}`);
  io.emit("incident:new", {
    incident,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast incident status update (e.g. assigned, en route, arrived) */
function broadcastIncidentStatus(incidentId, status, extra = {}) {
  if (!io) return;
  console.log(`📡 [Socket.IO] Broadcasting status update for incident #${incidentId} -> ${status}`);
  io.emit("incident:status_change", {
    incidentId: Number(incidentId),
    status,
    ...extra,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast hospital inventory/status changes */
function broadcastHospitalUpdate(hospitalId, data) {
  if (!io) return;
  console.log(`📡 [Socket.IO] Broadcasting update for hospital #${hospitalId}`);
  io.emit("hospital:updated", {
    hospitalId: Number(hospitalId),
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast dispatch request to targeted hospital room AND dashboard */
function broadcastDispatchRequest(dispatchData) {
  if (!io) return;
  const hospitalRoom = `hospital_${dispatchData.targetHospitalId}`;
  console.log(`🚨 [Socket.IO] Emitting dispatch request for incident #${dispatchData.incidentId} to room ${hospitalRoom} and public channel.`);

  // Targeted to hospital's terminal
  io.to(hospitalRoom).emit("incident:dispatch_request", {
    ...dispatchData,
    targeted: true,
    timestamp: new Date().toISOString()
  });

  // Global broadcast to emergency dispatchers dashboard
  io.emit("incident:dispatch_request", {
    ...dispatchData,
    targeted: false,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast hospital acceptance */
function broadcastHospitalAccepted(data) {
  if (!io) return;
  console.log(`🎉 [Socket.IO] Incident #${data.incidentId} accepted by hospital #${data.hospitalId} (${data.hospitalName})`);
  io.emit("incident:accepted", {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast hospital rejection */
function broadcastHospitalRejected(data) {
  if (!io) return;
  console.log(`⚠️ [Socket.IO] Incident #${data.incidentId} rejected by hospital #${data.hospitalId}. Reason: ${data.reason}`);
  io.emit("incident:rejected", {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast dispatch timeout */
function broadcastDispatchTimeout(data) {
  if (!io) return;
  console.log(`⏰ [Socket.IO] Dispatch timeout on incident #${data.incidentId} for hospital #${data.hospitalId} (Rank ${data.rankPosition})`);
  io.emit("incident:timed_out", {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast automatic escalation to next ranked hospital */
function broadcastIncidentEscalated(data) {
  if (!io) return;
  console.log(`⚡ [Socket.IO] Escalating incident #${data.incidentId} from hospital #${data.previousHospitalId} to Rank #${data.newRank} (Hospital #${data.newHospitalId}: ${data.newHospitalName})`);
  io.emit("incident:escalated", {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast exhaustion alert when all ranked hospitals are unavailable */
function broadcastIncidentExhausted(data) {
  if (!io) return;
  console.warn(`🚨 [Socket.IO] SUPERVISOR ALERT: Incident #${data.incidentId} exhausted all available hospitals!`);
  io.emit("incident:exhausted", {
    ...data,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast incident deletion */
function broadcastIncidentDeleted(incidentId) {
  if (!io) return;
  console.log(`🗑️ [Socket.IO] Broadcasting deletion of incident #${incidentId}`);
  io.emit("incident:deleted", {
    incidentId: Number(incidentId),
    timestamp: new Date().toISOString()
  });
}

/** Broadcast newly created hospital */
function broadcastHospitalCreated(hospital) {
  if (!io) return;
  console.log(`🏥 [Socket.IO] Broadcasting newly created hospital #${hospital.id} (${hospital.name})`);
  io.emit("hospital:created", {
    hospital,
    timestamp: new Date().toISOString()
  });
}

/** Broadcast hospital deletion */
function broadcastHospitalDeleted(hospitalId) {
  if (!io) return;
  console.log(`🗑️ [Socket.IO] Broadcasting deletion of hospital #${hospitalId}`);
  io.emit("hospital:deleted", {
    hospitalId: Number(hospitalId),
    timestamp: new Date().toISOString()
  });
}

/** Broadcast blood inventory update */
function broadcastBloodUpdate(hospitalId, data) {
  if (!io) return;
  console.log(`🩸 [Socket.IO] Broadcasting blood inventory update for hospital #${hospitalId}`);
  io.emit("hospital:blood_updated", {
    hospitalId: Number(hospitalId),
    ...data,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  init,
  getIO,
  setHospitalResponseHandler,
  broadcastNewIncident,
  broadcastIncidentStatus,
  broadcastHospitalUpdate,
  broadcastBloodUpdate,
  broadcastHospitalCreated,
  broadcastHospitalDeleted,
  broadcastDispatchRequest,
  broadcastHospitalAccepted,
  broadcastHospitalRejected,
  broadcastDispatchTimeout,
  broadcastIncidentEscalated,
  broadcastIncidentExhausted,
  broadcastIncidentDeleted
};
