/**
 * Express Application Configuration
 * Sets up middleware (JSON parsing, CORS) and base routes.
 */

const express = require("express");
const cors = require("cors");
const hospitalRoutes = require("./routes/hospitals");
const incidentRoutes = require("./routes/incidents");
const authRoutes = require("./routes/auth");
const analyticsRoutes = require("./routes/analytics");
const syncRoutes = require("./routes/sync");
const integrationRoutes = require("./routes/integration");
const evaluationRoutes = require("./routes/evaluation");

const app = express();

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : ["http://localhost:5173"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "MedLink Backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/integration", integrationRoutes);
app.use("/api/evaluation", evaluationRoutes);

module.exports = app;
