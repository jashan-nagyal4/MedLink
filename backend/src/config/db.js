/**
 * Database Connection Pool
 * Connects Node.js to PostgreSQL using the pg library.
 * Automatically enables SSL for remote/cloud database providers (Neon, Supabase, Render, etc.).
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { Pool } = require("pg");

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  // Safely auto-encode special characters in password (such as '@') if unencoded
  const matches = connectionString.match(/^postgresql:\/\/([^:]+):(.*)@([^@]+:\d+\/[^?]+)(.*)$/);
  if (matches) {
    const [, user, pass, hostAndDb, query] = matches;
    if (pass.includes("@")) {
      connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostAndDb}${query || ""}`;
    }
  }
}

const poolConfig = {
  connectionString
};

// Enable SSL if connecting to cloud/production databases (required by Render, Supabase, Neon)
const isRemoteDb = connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");
if (process.env.NODE_ENV === "production" || isRemoteDb) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
