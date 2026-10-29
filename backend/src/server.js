/**
 * Server Entrypoint - MedLink Dispatch System
 * Loads environment variables and starts listening on the designated PORT.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const http = require("http");

const app = require("./app");
const db = require("./config/db");
const socketService = require("./services/socketService");
const incidentSimulator = require("./services/incidentSimulator");

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Test database connection on startup
    await db.query("SELECT 1");
    console.log("Connected to PostgreSQL successfully!");
  } catch (err) {
    console.warn("⚠️ PostgreSQL not reachable yet:", err.message);
    console.warn("   (The API server will still start, but database queries will fail until PostgreSQL is running).");
  }

  // Create HTTP server wrapping Express
  const server = http.createServer(app);

  // Initialize Socket.IO real-time server
  socketService.init(server);

  server.listen(PORT, () => {
    console.log(` MedLink Backend is running at http://localhost:${PORT}`);
    console.log(` Socket.IO Real-time Engine listening on ws://localhost:${PORT}`);
    // Start automated background incident simulation (every 45s)
    incidentSimulator.start(45000);
  });
}

startServer();
