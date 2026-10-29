/**
 * Automated Verification Suite:
 * Incident Dispatch Tracking & Coordination APIs
 * 
 * Verifies:
 * 1. GET /api/incidents/:id/coordination returns complete payload for real-time frontend tracker:
 *    - Incident details with patient information and current FSM status
 *    - Active timer metadata (secondsRemaining, expiresAt, isActive, timeoutSeconds)
 *    - Multi-criteria ranked hospital list annotated with dispatchStatus (pending, accepted, rejected, queued)
 *    - Full audit trail of dispatch attempt logs
 * 2. GET /api/hospitals/:id returns equipment, bed capacity, and specialist roster for the detail inspector
 * 3. Hospital response simulator workflow (Accept, Decline with clinical reason) matches frontend expectations
 * 4. WebSocket status broadcasts feed the live UI alert banner
 */

require("dotenv").config();
const http = require("http");
const { io: ClientIO } = require("socket.io-client");
const app = require("../src/app");
const db = require("../src/config/db");
const socketService = require("../src/services/socketService");
const coordinationEngine = require("../src/services/coordinationEngine");

const TEST_PORT = 4003;
let server;
let socketClient;
const createdIncidentIds = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, path, body = null) {
  const url = `http://localhost:${TEST_PORT}${path}`;
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("===============================================================");
  console.log("  Incident Dispatch Tracking & Telemetry Verification Suite    ");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // 1. Start test backend server with Socket.IO
    server = http.createServer(app);
    socketService.init(server);
    await new Promise((resolve) => server.listen(TEST_PORT, resolve));

    socketClient = ClientIO(`http://localhost:${TEST_PORT}`);
    await new Promise((resolve) => socketClient.on("connect", resolve));

    assert(socketClient.connected, "Socket.IO client connected to backend");

    // 2. Create emergency incident
    console.log("\n1. Creating test emergency incident for UI tracker...");
    const incRes = await request("POST", "/api/incidents", {
      callerName: "Dr. Sharma (Field Paramedic)",
      callerPhone: "+91-9876543210",
      patient: {
        name: "Rahul Verma",
        age: 62,
        gender: "male",
        medicalHistory: "Type 2 Diabetes, Hypertension"
      },
      latitude: 32.7266,
      longitude: 74.8570,
      address: "Gandhi Nagar, Jammu",
      chiefComplaint: "Acute myocardial infarction with crushing retrosternal pain",
      conditionCategory: "cardiac",
      vitalSigns: {
        heartRate: 120,
        systolicBP: 85,
        spo2: 89,
        gcs: 15
      }
    });

    assert(incRes.status === 201, "Incident registered successfully");
    const incidentId = incRes.data.incident.id;
    createdIncidentIds.push(incidentId);

    // 3. Verify Initial Coordination State (Idle)
    console.log("\n2. Verifying Initial Coordination State before dispatch...");
    const state0 = await request("GET", `/api/incidents/${incidentId}/coordination`);

    assert(state0.status === 200, "GET /coordination returned 200 OK");
    assert(state0.data.incident.status === "reported", "Incident status is 'reported'");
    assert(state0.data.timer === null, "Timer is null before dispatch is started");
    assert(Array.isArray(state0.data.rankedHospitals), "Ranked hospitals queue is populated");
    assert(state0.data.rankedHospitals.length >= 3, "At least 3 candidate hospitals ranked");
    assert(state0.data.rankedHospitals[0].dispatchStatus === "queued", "Rank #1 hospital is queued");

    // 4. Start Automated Dispatch (FSM triggers Rank #1)
    console.log("\n3. Starting automated dispatch to test live tracking payload...");
    const startRes = await request("POST", `/api/incidents/${incidentId}/start-dispatch`, {
      timeoutSeconds: 45
    });

    assert(startRes.status === 200, "POST /start-dispatch returned 200 OK");
    assert(startRes.data.status === "requested", "FSM transitioned to 'requested'");

    // Check coordination state with active countdown timer
    const state1 = await request("GET", `/api/incidents/${incidentId}/coordination`);
    assert(state1.data.timer !== null, "Timer object present when dispatch is active");
    assert(state1.data.timer.isActive === true, "Timer isActive is true");
    assert(state1.data.timer.secondsRemaining > 40, "secondsRemaining matches active 45s countdown");
    assert(state1.data.timer.timeoutSeconds === 45, "timeoutSeconds is 45");

    const topHospId = Number(state1.data.timer.hospitalId);
    const rank1Item = state1.data.rankedHospitals.find((h) => Number(h.hospitalId || h.id) === topHospId);
    assert(rank1Item && rank1Item.dispatchStatus === "pending", "Contacted hospital marked as 'pending' in ranked list");

    // 5. Verify Hospital Detail Inspector (Drawer / Modal)
    console.log("\n4. Verifying Hospital Detail Inspector API (Resources & Specialists)...");
    const hospDetailRes = await request("GET", `/api/hospitals/${topHospId}`);

    assert(hospDetailRes.status === 200, "GET /hospitals/:id returned 200 OK");
    assert(hospDetailRes.data.hospital && hospDetailRes.data.hospital.name, "Hospital profile contains name");
    assert(Array.isArray(hospDetailRes.data.resources), "Hospital resources array present");
    assert(Array.isArray(hospDetailRes.data.specialists), "Hospital specialists array present");
    assert(hospDetailRes.data.resources.some((r) => r.resource_type.includes("Bed") || r.resource_type.includes("ICU")), "ICU or Hospital Bed resource verified in inventory");

    // 6. Test Hospital Response Simulator: Decline & Escalation
    console.log("\n5. Testing Hospital Simulator: Decline with Clinical Reason & Auto-Escalation...");
    let caughtEscalated = false;
    socketClient.once("incident:escalated", () => {
      caughtEscalated = true;
    });

    const rejectRes = await request("POST", `/api/incidents/${incidentId}/respond`, {
      hospitalId: topHospId,
      action: "reject",
      reason: "Emergency Department and ICU at full capacity"
    });

    assert(rejectRes.status === 200, "Simulated decline succeeded");
    assert(rejectRes.data.status === "escalated", "FSM transitioned to 'escalated'");

    await sleep(200);
    assert(caughtEscalated === true, "Socket.IO emitted 'incident:escalated' for live UI banner");

    // Check coordination state after escalation
    const state2 = await request("GET", `/api/incidents/${incidentId}/coordination`);
    const rejectedLog = state2.data.logs.find((l) => Number(l.hospital_id) === topHospId);
    assert(rejectedLog && rejectedLog.status === "rejected", "Declined hospital logged as 'rejected'");
    assert(rejectedLog.response_reason.includes("capacity"), "Decline reason preserved in audit log");

    const escalatedRankItem = state2.data.rankedHospitals.find((h) => Number(h.hospitalId || h.id) === topHospId);
    assert(escalatedRankItem && escalatedRankItem.dispatchStatus === "rejected", "Hospital status updated to 'rejected' in UI list");

    // 7. Test Hospital Response Simulator: Accept
    console.log("\n6. Testing Hospital Simulator: Accept & Allocate...");
    const newTargetHospId = Number(state2.data.timer.hospitalId);
    let caughtAccepted = false;
    socketClient.once("incident:accepted", () => {
      caughtAccepted = true;
    });

    const acceptRes = await request("POST", `/api/incidents/${incidentId}/respond`, {
      hospitalId: newTargetHospId,
      action: "accept",
      reason: "Emergency Cath Lab prepped and ready for STEMI patient"
    });

    assert(acceptRes.status === 200, "Simulated acceptance succeeded");
    assert(acceptRes.data.status === "assigned", "Incident status is 'assigned'");

    await sleep(200);
    assert(caughtAccepted === true, "Socket.IO emitted 'incident:accepted' for live UI banner");

    const stateFinal = await request("GET", `/api/incidents/${incidentId}/coordination`);
    assert(stateFinal.data.incident.status === "assigned", "Final incident status is 'assigned'");
    assert(stateFinal.data.timer === null, "Timer stopped after acceptance");

    const acceptedItem = stateFinal.data.rankedHospitals.find((h) => Number(h.hospitalId || h.id) === newTargetHospId);
    assert(acceptedItem && acceptedItem.dispatchStatus === "accepted", "Assigned hospital marked as 'accepted' in UI queue");

    console.log("\n===============================================================");
    console.log(`  ALL ${passed}/${total} TRACKING VERIFICATION TESTS PASSED!  `);
    console.log("===============================================================");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    for (const incId of createdIncidentIds) {
      coordinationEngine.clearIncidentTimer(incId);
    }
    if (createdIncidentIds.length > 0) {
      await db.query(`DELETE FROM emergency_incidents WHERE id = ANY($1)`, [createdIncidentIds]);
    }
    if (socketClient) socketClient.disconnect();
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  }
}

runTests();
