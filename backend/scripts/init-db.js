/**
 * Database Initialization Script
 * Reads db/schema.sql and executes it against PostgreSQL.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

async function initDatabase() {
  try {
    console.log("Connecting to PostgreSQL...");
    const schemaSql = fs.readFileSync(path.join(__dirname, "../db/schema.sql"), "utf8");
    await db.query(schemaSql);
    console.log(" Database schema created successfully! (Hospitals, Resources, Specialists)");
  } catch (err) {
    console.error("❌ Database initialization error:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

initDatabase();
