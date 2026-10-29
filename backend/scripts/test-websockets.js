/**
 * Real-Time Socket.IO WebSocket Communication & Push Alerts Automated Verification Suite
 */

const http = require("http");
const assert = require("assert");
const { io: Client } = require("socket.io-client");
const socketService = require("../src/services/socketService");

async function runTests() {
  console.log("\n=======================================================");
  console.log(" MedLink Real-Time Telemetry Suite (Socket.IO)");
  console.log("=======================================================\n");

  const TEST_PORT = 4005;
  const server = http.createServer();
  const ioServer = socketService.init(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`  [PASS] Test HTTP & Socket.IO server running on port ${TEST_PORT}`);

  // Create test client
  const clientSocket = Client(`http://localhost:${TEST_PORT}`, {
    transports: ["websocket"]
  });

  await new Promise((resolve, reject) => {
    clientSocket.on("connect", resolve);
    clientSocket.on("connect_error", reject);
  });
  console.log("  [PASS] Client connected via WebSocket!");

  // Test 1: Real-time broadcast of new incident
  await new Promise((resolve, reject) => {
    clientSocket.on("incident:new", (data) => {
      try {
        assert.strictEqual(data.incident.incident_number, "INC-SOCKET-TEST");
        console.log("  [PASS] Caught 'incident:new' real-time broadcast!");
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    socketService.broadcastNewIncident({
      id: 9999,
      incident_number: "INC-SOCKET-TEST",
      address: "Jammu Center",
      severity: "critical"
    });
  });

  // Test 2: Real-time status update broadcast
  await new Promise((resolve, reject) => {
    clientSocket.on("incident:status_change", (data) => {
      try {
        assert.strictEqual(data.status, "assigned");
        assert.strictEqual(data.assignedHospitalId, 1);
        console.log("  [PASS] Caught 'incident:status_change' real-time broadcast!");
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    socketService.broadcastIncidentStatus(9999, "assigned", { assignedHospitalId: 1 });
  });

  // Test 3: Hospital acknowledgement event
  await new Promise((resolve, reject) => {
    clientSocket.on("incident:acknowledged", (data) => {
      try {
        assert.strictEqual(data.incidentId, 9999);
        assert.strictEqual(data.hospitalName, "GMC Jammu");
        console.log("  [PASS] Hospital acknowledgement round-trip event verified!");
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    clientSocket.emit("incident:acknowledge", {
      incidentId: 9999,
      hospitalId: 1,
      hospitalName: "GMC Jammu"
    });
  });

  // Cleanup
  clientSocket.disconnect();
  ioServer.close();
  await new Promise((resolve) => server.close(resolve));

  console.log("\n=======================================================");
  console.log(" Results: All 5 Real-Time Socket.IO Tests Passed! 🎉");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
