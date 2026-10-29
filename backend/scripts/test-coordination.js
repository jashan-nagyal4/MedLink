/**
 * Automated Test Suite: Event-Driven Dispatch Coordination and Escalation
 * 
 * Verifies:
 * 1. Finite State Machine (FSM) transitions:
 *    REPORTED -> REQUESTED -> (ACCEPTED | REJECTED | TIMED_OUT) -> ESCALATED -> EXHAUSTED
 * 2. Event-driven Socket.IO communication (dispatch requests to hospital rooms, acceptance, rejection, escalation alerts).
 * 3. Timeout mechanisms with automatic escalation to next-ranked hospital.
 * 4. Multi-hospital rejection and timeout handling leading to supervisor exhaustion alert.
 * 5. Full audit logging in incident_dispatch_logs.
 */

require("dotenv").config();
const http = require("http");
const { io: ClientIO } = require("socket.io-client");
const app = require("../src/app");
const db = require("../src/config/db");
const socketService = require("../src/services/socketService");
const coordinationEngine = require("../src/services/coordinationEngine");

const TEST_PORT = 4002;
let server;
let globalClientSocket;
let hospital1Socket;

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

async function createTestIncident(complaint, lat = 32.7266, lng = 74.857) {
  const payload = {
    callerName: "Paramedic Unit 4",
    callerPhone: "+91-9988776655",
    patient: {
      name: "Test Subject",
      age: 58,
      gender: "male",
      medicalHistory: "Prior CAD"
    },
    latitude: lat,
    longitude: lng,
    address: "Residency Road, Jammu",
    chiefComplaint: complaint,
    conditionCategory: "cardiac",
    vitalSigns: {
      heartRate: 135,
      systolicBP: 80,
      spo2: 88,
      gcs: 14
    }
  };

  const res = await request("POST", "/api/incidents", payload);
  if (!res.ok) {
    throw new Error(`Failed to create test incident: ${JSON.stringify(res.data)}`);
  }
  const incidentId = res.data.incident.id;
  createdIncidentIds.push(incidentId);
  return res.data.incident;
}

async function runTests() {
  console.log("===============================================================");
  console.log("  Event-Driven Dispatch Coordination & Escalation Test Suite  ");
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
    // 1. Start test HTTP and Socket.IO server
    console.log("1. Starting test backend server with Socket.IO on port " + TEST_PORT + "...");
    server = http.createServer(app);
    socketService.init(server);

    await new Promise((resolve) => server.listen(TEST_PORT, resolve));

    // Connect global dispatcher socket client
    globalClientSocket = ClientIO(`http://localhost:${TEST_PORT}`);
    await new Promise((resolve) => globalClientSocket.on("connect", resolve));

    // Connect simulated hospital terminal socket client
    hospital1Socket = ClientIO(`http://localhost:${TEST_PORT}`);
    await new Promise((resolve) => hospital1Socket.on("connect", resolve));

    assert(globalClientSocket.connected && hospital1Socket.connected, "Socket.IO clients connected");

    // =========================================================================
    // TEST 1: Dispatch to Rank #1 Hospital & Socket.IO Targeted Delivery
    // =========================================================================
    console.log("\n2. Test 1: Start Dispatch to Rank #1 Hospital");
    const incidentA = await createTestIncident("Severe chest pain radiating to left arm (STEMI)");

    // Determine the expected Rank #1 hospital for this incident
    const rankedCheck = await request("GET", `/api/incidents/${incidentA.id}/ranked-hospitals`);
    const expectedTopHosp = rankedCheck.data.rankedHospitals[0];
    const topHospId = Number(expectedTopHosp.hospitalId || expectedTopHosp.id);

    // Hospital terminal joins the targeted room for this top hospital
    hospital1Socket.emit("hospital:join", topHospId);
    await sleep(100);

    let receivedDispatchRequest = null;
    let hospitalRoomReceived = false;

    globalClientSocket.once("incident:dispatch_request", (data) => {
      receivedDispatchRequest = data;
    });

    hospital1Socket.once("incident:dispatch_request", (data) => {
      if (data.targeted) {
        hospitalRoomReceived = true;
      }
    });

    const dispatchA = await request("POST", `/api/incidents/${incidentA.id}/start-dispatch`, {
      timeoutSeconds: 30
    });

    assert(dispatchA.status === 200, "POST /start-dispatch returned 200 OK");
    assert(dispatchA.data.status === "requested", "Incident status transitioned to 'requested'");
    assert(dispatchA.data.rankPosition === 1, "Rank #1 hospital was automatically selected");
    assert(dispatchA.data.targetHospital && dispatchA.data.targetHospital.id, "Target hospital metadata present");

    await sleep(200);
    assert(receivedDispatchRequest !== null, "Global dispatcher received 'incident:dispatch_request' event");
    assert(hospitalRoomReceived === true, "Hospital terminal received targeted dispatch request via room");

    // Check DB dispatch log
    const logCheckA = await db.query(
      `SELECT * FROM incident_dispatch_logs WHERE incident_id = $1 AND status = 'pending'`,
      [incidentA.id]
    );
    assert(logCheckA.rowCount === 1, "Database recorded active 'pending' log in incident_dispatch_logs");

    // =========================================================================
    // TEST 2: Hospital Acceptance Flow (REQUESTED -> ACCEPTED -> ASSIGNED)
    // =========================================================================
    console.log("\n3. Test 2: Hospital Acceptance Flow");
    const targetHospId = dispatchA.data.targetHospital.id;

    let receivedAcceptedEvent = null;
    globalClientSocket.once("incident:accepted", (data) => {
      receivedAcceptedEvent = data;
    });

    const acceptRes = await request("POST", `/api/incidents/${incidentA.id}/respond`, {
      hospitalId: targetHospId,
      action: "accept",
      reason: "Cath Lab and CCU bed prepared"
    });

    assert(acceptRes.status === 200, "POST /respond (accept) returned 200 OK");
    assert(acceptRes.data.status === "assigned", "Incident status successfully updated to 'assigned'");

    await sleep(200);
    assert(receivedAcceptedEvent !== null, "Socket.IO emitted 'incident:accepted' event");
    assert(receivedAcceptedEvent.hospitalId === targetHospId, "Accepted event contains correct hospitalId");

    // Verify DB state
    const incCheckA = await db.query(
      `SELECT status, assigned_hospital_id FROM emergency_incidents WHERE id = $1`,
      [incidentA.id]
    );
    assert(incCheckA.rows[0].status === "assigned", "emergency_incidents table status is 'assigned'");
    assert(Number(incCheckA.rows[0].assigned_hospital_id) === targetHospId, "assigned_hospital_id matches accepted hospital");

    // =========================================================================
    // TEST 3: Hospital Rejection & Immediate Auto-Escalation Flow
    // =========================================================================
    console.log("\n4. Test 3: Hospital Rejection & Immediate Auto-Escalation");
    const incidentB = await createTestIncident("Hypotensive trauma with internal bleeding");

    const dispatchB = await request("POST", `/api/incidents/${incidentB.id}/start-dispatch`, {
      timeoutSeconds: 30
    });
    const firstHospId = dispatchB.data.targetHospital.id;

    let receivedRejectedEvent = null;
    let receivedEscalatedEvent = null;

    globalClientSocket.once("incident:rejected", (data) => {
      receivedRejectedEvent = data;
    });
    globalClientSocket.once("incident:escalated", (data) => {
      receivedEscalatedEvent = data;
    });

    // Simulate hospital rejecting the request
    const rejectRes = await request("POST", `/api/incidents/${incidentB.id}/respond`, {
      hospitalId: firstHospId,
      action: "reject",
      reason: "Trauma OR currently occupied"
    });

    assert(rejectRes.status === 200, "POST /respond (reject) returned 200 OK");
    assert(rejectRes.data.status === "escalated", "Response indicates status transitioned to 'escalated'");

    await sleep(200);
    assert(receivedRejectedEvent !== null, "Socket.IO emitted 'incident:rejected' event");
    assert(receivedEscalatedEvent !== null, "Socket.IO emitted 'incident:escalated' event");
    assert(receivedEscalatedEvent.newRank === 2, "Automatic escalation moved to Rank #2 hospital");
    assert(receivedEscalatedEvent.newHospitalId !== firstHospId, "New hospital is different from rejected hospital");

    // Verify DB log for rejection
    const logCheckB = await db.query(
      `SELECT hospital_id, status, response_reason FROM incident_dispatch_logs WHERE incident_id = $1 ORDER BY requested_at ASC`,
      [incidentB.id]
    );
    assert(logCheckB.rows[0].status === "rejected", "First dispatch log status marked as 'rejected'");
    assert(logCheckB.rows[1].status === "pending", "Second dispatch log created for escalated hospital with 'pending'");

    // Clean up incidentB timer
    coordinationEngine.clearIncidentTimer(incidentB.id);

    // =========================================================================
    // TEST 4: Timeout Expiration & Automatic Escalation
    // =========================================================================
    console.log("\n5. Test 4: Timeout Expiration & Automatic Escalation");
    const incidentC = await createTestIncident("Severe respiratory distress / SpO2 75%");

    let receivedTimeoutEvent = null;
    let timeoutEscalatedEvent = null;

    globalClientSocket.once("incident:timed_out", (data) => {
      receivedTimeoutEvent = data;
    });
    globalClientSocket.once("incident:escalated", (data) => {
      timeoutEscalatedEvent = data;
    });

    // Start dispatch with a rapid 1.5-second timeout for testing
    const dispatchC = await request("POST", `/api/incidents/${incidentC.id}/start-dispatch`, {
      timeoutSeconds: 2
    });
    const timedHospId = dispatchC.data.targetHospital.id;

    assert(dispatchC.data.timeoutSeconds === 2, "Dispatch armed with 2-second timeout");

    console.log("  ⏳ Waiting 2.5 seconds for timeout countdown to expire...");
    await sleep(2500);

    assert(receivedTimeoutEvent !== null, "Socket.IO emitted 'incident:timed_out' event after expiry");
    assert(receivedTimeoutEvent.hospitalId === timedHospId, "Timeout event refers to the unresponding hospital");
    assert(timeoutEscalatedEvent !== null, "Socket.IO emitted 'incident:escalated' event following timeout");
    assert(timeoutEscalatedEvent.newRank === 2, "Escalation auto-advanced to Rank #2 hospital");

    // Clean up incidentC timer
    coordinationEngine.clearIncidentTimer(incidentC.id);

    // =========================================================================
    // TEST 5: Hospital Pool Exhaustion (Supervisor Alert)
    // =========================================================================
    console.log("\n6. Test 5: Exhaustion Alert when All Hospitals are Unavailable");
    const incidentD = await createTestIncident("Multisystem trauma patient");

    let receivedExhaustedEvent = null;
    globalClientSocket.on("incident:exhausted", (data) => {
      receivedExhaustedEvent = data;
    });

    // Start dispatch with fast timeout
    const dispatchD = await request("POST", `/api/incidents/${incidentD.id}/start-dispatch`, { timeoutSeconds: 30 });
    let nextTarget = dispatchD.data.targetHospital;

    // Reject consecutively until all hospitals are exhausted
    while (nextTarget && nextTarget.id) {
      const rejectAttempt = await request("POST", `/api/incidents/${incidentD.id}/respond`, {
        hospitalId: nextTarget.id,
        action: "reject",
        reason: "Capacity full / specialist unavailable"
      });

      if (rejectAttempt.data.escalation && rejectAttempt.data.escalation.targetHospital) {
        nextTarget = rejectAttempt.data.escalation.targetHospital;
      } else {
        nextTarget = null;
      }
    }

    await sleep(300);
    assert(receivedExhaustedEvent !== null, "Socket.IO emitted 'incident:exhausted' alert");

    const incCheckD = await db.query(`SELECT status FROM emergency_incidents WHERE id = $1`, [incidentD.id]);
    assert(incCheckD.rows[0].status === "exhausted", "Incident status transitioned to 'exhausted'");

    // =========================================================================
    // TEST 6: Get Full Coordination Audit State
    // =========================================================================
    console.log("\n7. Test 6: Get Full Coordination State & Audit Logs");
    const stateRes = await request("GET", `/api/incidents/${incidentD.id}/coordination`);

    assert(stateRes.status === 200, "GET /coordination returned 200 OK");
    assert(Array.isArray(stateRes.data.logs), "Coordination logs array returned");
    assert(stateRes.data.logs.length >= 2, "Multiple dispatch attempt logs preserved for audit");
    assert(Array.isArray(stateRes.data.rankedHospitals), "Ranked hospitals list returned");
    assert(stateRes.data.incident.status === "exhausted", "Incident state is 'exhausted'");

    console.log("\n===============================================================");
    console.log(`  ALL ${passed}/${total} COORDINATION TESTS PASSED SUCCESSFULLY!  `);
    console.log("===============================================================");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    // Clear all in-memory timers
    for (const incId of createdIncidentIds) {
      coordinationEngine.clearIncidentTimer(incId);
    }

    // Clean up test records
    if (createdIncidentIds.length > 0) {
      console.log("\n🧹 Cleaning up test incidents...");
      await db.query(`DELETE FROM emergency_incidents WHERE id = ANY($1)`, [createdIncidentIds]);
    }

    if (globalClientSocket) globalClientSocket.disconnect();
    if (hospital1Socket) hospital1Socket.disconnect();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.pool.end();
  }
}

runTests();
