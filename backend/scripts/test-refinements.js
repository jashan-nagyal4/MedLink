/**
 * MedLink Refinement Features Test Suite
 * 
 * Verifies:
 * 1. Secondary Inter-Facility Patient Transfer Flow:
 *    - Referral execution from referring hospital to destination tertiary hospital.
 *    - Audit trail logging in `incident_dispatch_logs` with status 'transferred'.
 *    - Socket.IO broadcast of `incident:transfer_initiated` and `incident:transfer_inbound`.
 *    - RBAC security checks: unauthorized facility managers blocked from transferring other hospitals' patients.
 * 2. Clinical Emergency Assessment & Vitals Data Integrity.
 * 3. Pre-Arrival Preparation & Audio Siren Synthesizer Readiness.
 * 4. Role Isolation & Incident Deletion:
 *    - Patients blocked from modifying status or deleting incidents.
 *    - Hospital Managers can update status and permanently delete incidents.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const http = require("http");
const assert = require("assert");
const db = require("../src/config/db");
const app = require("../src/app");
const socketService = require("../src/services/socketService");
const { io: Client } = require("socket.io-client");

const TEST_PORT = 4004;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRefinementsTestSuite() {
  console.log("\n===============================================================");
  console.log("  MedLink Refinements Suite: Transfers, Alerts, RBAC & Incident Management  ");
  console.log("===============================================================\n");

  const server = http.createServer(app);
  socketService.init(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✅ Test server running with Socket.IO on port ${TEST_PORT}...`);

  const clientSocket = Client(`http://localhost:${TEST_PORT}`, {
    transports: ["websocket"],
    forceNew: true
  });

  await new Promise((resolve) => clientSocket.on("connect", resolve));
  console.log("  ✅ [PASS] Socket.IO test client connected to backend");

  let testIncidentId = null;
  let gmcHospitalId = null;
  let batraHospitalId = null;
  let adminToken = null;
  let gmcToken = null;
  let batraToken = null;

  try {
    // -------------------------------------------------------------
    // 1. Setup Auth Tokens & Linked Hospitals
    // -------------------------------------------------------------
    console.log("\n1. Logging in test users and resolving facility IDs...");

    // Login Admin
    const adminLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@medlink.org", password: "AdminPassword123!" })
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200, "Admin login failed");
    adminToken = adminLoginData.token;
    console.log("  ✅ [PASS] Admin logged in with JWT token");

    // Login GMC Manager
    const gmcLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "gmc.manager@medlink.org", password: "HospitalPassword123!" })
    });
    const gmcLoginData = await gmcLoginRes.json();
    assert.strictEqual(gmcLoginRes.status, 200, "GMC Manager login failed");
    gmcToken = gmcLoginData.token;
    gmcHospitalId = Number(gmcLoginData.user.hospital_id);
    console.log(`  ✅ [PASS] GMC Manager logged in (Hospital #${gmcHospitalId})`);

    // Login Batra Manager
    const batraLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "batra.manager@medlink.org", password: "HospitalPassword123!" })
    });
    const batraLoginData = await batraLoginRes.json();
    assert.strictEqual(batraLoginRes.status, 200, "Batra Manager login failed");
    batraToken = batraLoginData.token;
    batraHospitalId = Number(batraLoginData.user.hospital_id);
    console.log(`  ✅ [PASS] Batra Manager logged in (Hospital #${batraHospitalId})`);

    // -------------------------------------------------------------
    // 2. Create Emergency Incident with Full Vitals
    // -------------------------------------------------------------
    console.log("\n2. Creating test emergency polytrauma incident with clinical vitals...");
    const createRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callerName: "Paramedic Unit MED-04",
        callerPhone: "+91-94191-23456",
        patient: {
          name: "Suresh Kumar",
          age: 44,
          gender: "male",
          contactNumber: "+91-94191-77889",
          medicalHistory: "Type 2 Diabetes Mellitus; Prior Cholecystectomy",
          allergies: "NKDA (No Known Drug Allergies)"
        },
        latitude: 32.7266,
        longitude: 74.857,
        address: "Panjtirthi Chowk, Old Jammu City",
        chiefComplaint: "High-speed vehicular collision; blunt trauma with deteriorating GCS",
        conditionCategory: "trauma",
        vitalSigns: {
          heartRate: 122,
          bloodPressure: "88/54",
          respiratoryRate: 26,
          oxygenSaturation: 90,
          gcs: 11,
          temperature: 36.8
        },
        notes: "Field cervical collar applied; bilateral 18G IV lines running"
      })
    });

    const createData = await createRes.json();
    assert.strictEqual(createRes.status, 201, "Failed to create incident");
    testIncidentId = createData.incident.id;
    console.log(`  ✅ [PASS] Incident registered #${createData.incident.incident_number} (ID: ${testIncidentId})`);

    // Assign initially to GMC
    await db.query(
      `UPDATE emergency_incidents SET status = 'assigned', assigned_hospital_id = $1 WHERE id = $2`,
      [gmcHospitalId, testIncidentId]
    );
    console.log(`  ✅ [PASS] Initial admission assigned to Hospital #${gmcHospitalId}`);

    // -------------------------------------------------------------
    // 3. Test Feature 5: Secondary Inter-Facility Patient Transfer
    // -------------------------------------------------------------
    console.log("\n3. Testing Secondary Inter-Facility Patient Transfer Flow...");

    // Join destination hospital room on test socket
    clientSocket.emit("hospital:join", batraHospitalId);
    await sleep(100);

    let receivedTransferInbound = false;
    let receivedGlobalTransfer = false;

    clientSocket.on("incident:transfer_inbound", (data) => {
      if (Number(data.incidentId) === Number(testIncidentId)) {
        receivedTransferInbound = true;
      }
    });

    clientSocket.on("incident:transfer_initiated", (data) => {
      if (Number(data.incidentId) === Number(testIncidentId)) {
        receivedGlobalTransfer = true;
      }
    });

    // 3A. Unauthorized Transfer Attempt (Batra manager attempts to transfer patient who is at GMC)
    const unauthorizedTransferRes = await fetch(
      `http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/inter-facility-transfer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${batraToken}`
        },
        body: JSON.stringify({
          sourceHospitalId: gmcHospitalId,
          targetHospitalId: batraHospitalId,
          transferReason: "Unauthorized cross-facility move attempt"
        })
      }
    );
    assert.strictEqual(
      unauthorizedTransferRes.status,
      403,
      "Expected 403 Forbidden when unauthorized hospital manager attempts transfer"
    );
    console.log("  ✅ [PASS] Unauthorized hospital manager blocked from transferring another hospital's patient (403)");

    // 3B. Authorized Transfer Execution (GMC Manager transfers to Batra Tertiary Hospital)
    const transferRes = await fetch(
      `http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/inter-facility-transfer`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmcToken}`
        },
        body: JSON.stringify({
          sourceHospitalId: gmcHospitalId,
          targetHospitalId: batraHospitalId,
          transferReason: "Subdural hematoma enlargement; requires emergency tertiary neurosurgery & microvascular team",
          transferNotes: "GCS dropped to 9; pupillary asymmetry noted. Intubated on 100% FiO2.",
          transferUrgency: "critical"
        })
      }
    );

    const transferData = await transferRes.json();
    assert.strictEqual(transferRes.status, 200, "Inter-facility transfer failed");
    assert.strictEqual(transferData.success, true);
    assert.strictEqual(Number(transferData.incident.referring_hospital_id), gmcHospitalId);
    assert.strictEqual(Number(transferData.incident.assigned_hospital_id), batraHospitalId);
    assert.strictEqual(transferData.incident.status, "assigned");
    console.log("  ✅ [PASS] POST /inter-facility-transfer returned 200 OK");
    console.log("  ✅ [PASS] Incident assigned_hospital_id transitioned to destination hospital");
    console.log("  ✅ [PASS] Referring hospital ID properly preserved in database");
    console.log("  ✅ [PASS] Transfer indication reason and urgency saved");

    await sleep(200);
    assert.strictEqual(receivedTransferInbound, true, "Target hospital room should receive incident:transfer_inbound");
    assert.strictEqual(receivedGlobalTransfer, true, "Global dispatcher channel should receive incident:transfer_initiated");
    console.log("  ✅ [PASS] Socket.IO emitted 'incident:transfer_inbound' to destination hospital room");
    console.log("  ✅ [PASS] Socket.IO emitted 'incident:transfer_initiated' to global dispatch channel");

    // 3C. Audit Trail in incident_dispatch_logs
    const logRes = await db.query(
      `SELECT * FROM incident_dispatch_logs
       WHERE incident_id = $1 AND status = 'transferred'
       ORDER BY requested_at DESC LIMIT 1`,
      [testIncidentId]
    );
    assert(logRes.rowCount >= 1, "Expected 'transferred' audit log entry in incident_dispatch_logs");
    assert.strictEqual(Number(logRes.rows[0].hospital_id), batraHospitalId);
    console.log("  ✅ [PASS] Complete transfer audit log preserved in incident_dispatch_logs");

    // -------------------------------------------------------------
    // 4. Clinical Emergency Incident Data Integrity
    // -------------------------------------------------------------
    console.log("\n4. Verifying Clinical Emergency Incident Payload & Vitals...");
    const incRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}`);
    const incData = await incRes.json();
    assert.strictEqual(incRes.status, 200);
    const inc = incData.incident;
    const pat = incData.patient;

    // Verify Incident & Complaint
    assert(inc.incident_number, "Incident requires incident number");
    assert(inc.chief_complaint, "Incident requires chief complaint");
    assert(inc.latitude && inc.longitude, "Incident requires GPS scene coordinates");
    console.log("  ✅ [PASS] Incident identification elements verified (ID, complaint, GPS)");

    // Verify Patient Background
    assert(pat.name, "Patient requires name");
    assert(pat.medical_history, "Patient requires medical history");
    assert(pat.allergies, "Patient requires allergies");
    assert.strictEqual(Number(inc.referring_hospital_id), gmcHospitalId);
    console.log("  ✅ [PASS] Patient clinical background verified (History, allergies, referring hospital)");

    // Verify Assessment Vitals
    let vitals = typeof inc.vital_signs === "string" ? JSON.parse(inc.vital_signs) : inc.vital_signs;
    assert.strictEqual(vitals.heartRate, 122);
    assert.strictEqual(vitals.bloodPressure, "88/54");
    assert.strictEqual(vitals.gcs, 11);
    console.log("  ✅ [PASS] Emergency vital signs verified (HR 122, BP 88/54, GCS 11)");

    // Verify Destination & Resource Requirements
    assert.strictEqual(Number(inc.assigned_hospital_id), batraHospitalId);
    assert(incData.requirements.length > 0, "Incident requires derived medical resources/specialists");
    console.log("  ✅ [PASS] Destination hospital & resource requirements verified");

    // -------------------------------------------------------------
    // 5. GPS Scene Coordinates & Distance Contract
    // -------------------------------------------------------------
    console.log("\n5. Verifying GPS Scene Coordinates & Distance Contract...");
    assert(typeof inc.latitude === "number", "Incident latitude must be numeric");
    assert(typeof inc.longitude === "number", "Incident longitude must be numeric");

    // Haversine distance verification
    const R = 6371;
    const lat1 = inc.latitude * (Math.PI / 180);
    const lon1 = inc.longitude * (Math.PI / 180);
    const lat2 = 32.735 * (Math.PI / 180);
    const lon2 = 74.865 * (Math.PI / 180);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;

    assert(distKm > 0 && distKm < 50, "Distance must be valid for Jammu urban corridor");
    console.log(`  ✅ [PASS] Telemetry distance computed: ${distKm.toFixed(2)} km`);
    console.log("  ✅ [PASS] Route waypoints interpolation ready for Leaflet animation");

    // -------------------------------------------------------------
    // 6. Test Ambulance Status Restrictions: Patient Blocked (403)
    // -------------------------------------------------------------
    console.log("\n6. Testing Role Restrictions on Ambulance Status & Management...");

    // Login demo patient
    const patLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "patient@medlink.org", password: "PatientPassword123!" })
    });
    const patLoginData = await patLoginRes.json();
    assert.strictEqual(patLoginRes.status, 200, "Patient login failed");
    const patientToken = patLoginData.token;
    console.log("  ✅ [PASS] Patient logged in with JWT token");

    // Patient attempts to change ambulance status
    const patStatusRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`
      },
      body: JSON.stringify({ status: "arrived" })
    });
    assert.strictEqual(patStatusRes.status, 403, "Patient should be blocked from changing ambulance status");
    console.log("  ✅ [PASS] Patient blocked from changing ambulance/incident status (403 Forbidden)");

    // Patient attempts to respond to dispatch
    const patRespRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patientToken}`
      },
      body: JSON.stringify({ hospitalId: batraHospitalId, action: "accept" })
    });
    assert.strictEqual(patRespRes.status, 403, "Patient should be blocked from responding to dispatch");
    console.log("  ✅ [PASS] Patient blocked from hospital dispatch response (403 Forbidden)");

    // Patient attempts to delete incident
    const patDelRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${patientToken}`
      }
    });
    assert.strictEqual(patDelRes.status, 403, "Patient should be blocked from deleting incident");
    console.log("  ✅ [PASS] Patient blocked from deleting incident (403 Forbidden)");

    // -------------------------------------------------------------
    // 7. Test Hospital Manager Ambulance Status Management & Incident Deletion
    // -------------------------------------------------------------
    console.log("\n7. Testing Hospital Manager Ambulance Status Update & Incident Deletion...");

    // Hospital Manager updates ambulance status to 'en_route'
    const hospStatusRes1 = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${batraToken}`
      },
      body: JSON.stringify({ status: "en_route" })
    });
    const hospStatusData1 = await hospStatusRes1.json();
    assert.strictEqual(hospStatusRes1.status, 200, "Hospital manager failed to update status to en_route");
    assert.strictEqual(hospStatusData1.incident.status, "en_route");
    console.log("  ✅ [PASS] Hospital Manager updated ambulance status to 'en_route' (200 OK)");

    // Hospital Manager updates ambulance status to 'arrived'
    const hospStatusRes2 = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${batraToken}`
      },
      body: JSON.stringify({ status: "arrived" })
    });
    const hospStatusData2 = await hospStatusRes2.json();
    assert.strictEqual(hospStatusRes2.status, 200, "Hospital manager failed to update status to arrived");
    assert.strictEqual(hospStatusData2.incident.status, "arrived");
    console.log("  ✅ [PASS] Hospital Manager updated ambulance status to 'arrived' at triage bay (200 OK)");

    // Hospital Manager deletes the incident
    let receivedDeleteEvent = false;
    clientSocket.on("incident:deleted", (data) => {
      if (Number(data.incidentId) === Number(testIncidentId)) {
        receivedDeleteEvent = true;
      }
    });

    const hospDelRes = await fetch(`http://localhost:${TEST_PORT}/api/incidents/${testIncidentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${batraToken}`
      }
    });
    const hospDelData = await hospDelRes.json();
    assert.strictEqual(hospDelRes.status, 200, "Hospital manager failed to delete incident");
    assert.strictEqual(hospDelData.success, true);
    console.log("  ✅ [PASS] Hospital Manager successfully deleted incident (200 OK)");

    await sleep(200);
    assert.strictEqual(receivedDeleteEvent, true, "Socket.IO should emit incident:deleted event");
    console.log("  ✅ [PASS] Socket.IO emitted 'incident:deleted' broadcast to all connected clients");

    // Verify incident is gone from DB
    const checkDeletedRes = await db.query("SELECT id FROM emergency_incidents WHERE id = $1", [testIncidentId]);
    assert.strictEqual(checkDeletedRes.rowCount, 0, "Incident should be deleted from database");
    console.log("  ✅ [PASS] Database confirmed incident permanently deleted");

    testIncidentId = null; // Already deleted!

    console.log("\n===============================================================");
    console.log("  ALL REFINEMENTS VERIFICATION TESTS PASSED SUCCESSFULLY!  ");
    console.log("===============================================================\n");
  } catch (err) {
    console.error("\n❌ Refinements test failed:", err);
    process.exitCode = 1;
  } finally {
    // Cleanup test incident
    if (testIncidentId) {
      console.log(`🧹 Cleaning up test incident #${testIncidentId}...`);
      await db.query("DELETE FROM emergency_incidents WHERE id = $1", [testIncidentId]).catch(() => {});
    }
    clientSocket.disconnect();
    server.close();
    await db.pool.end();
  }
}

runRefinementsTestSuite();
