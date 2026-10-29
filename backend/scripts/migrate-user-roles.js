/**
 * Migration: Pre-assigned Roles & Role Access Management
 * 
 * Creates `preassigned_roles` table to allow admins to assign roles
 * by email in advance. Any user registering without a predefined role
 * automatically becomes a Citizen ('patient').
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

const sql = `
-- 1. Create preassigned_roles table
CREATE TABLE IF NOT EXISTS preassigned_roles (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'patient',
  hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  assigned_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS preassigned_roles_email_idx ON preassigned_roles (LOWER(email));

-- 2. Ensure users check constraint supports citizen as an alias for patient
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'hospital_manager', 'hospital_staff', 'patient', 'citizen'));
`;

async function runMigration() {
  try {
    console.log("Applying preassigned_roles table migration...");
    await db.query(sql);
    console.log("✅ preassigned_roles table and role check constraint successfully applied.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration();
