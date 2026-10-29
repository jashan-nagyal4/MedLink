/**
 * User Authentication & Role-Based Access Control Migration Script
 * 
 * 1. Updates `users` table with roles: 'admin', 'hospital_manager', 'patient'.
 * 2. Links hospital managers to their specific `hospital_id`.
 * 3. Adds `phone` and audit columns.
 * 4. Adds `reported_by_user_id` to `emergency_incidents`.
 * 5. Seeds demo user accounts for 1-click evaluation.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../src/config/db");

const schemaSql = `
-- Drop previous restrictive constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_hospital_manager_check;

-- Add phone and missing columns if not present
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update any legacy roles
UPDATE users SET role = 'hospital_manager' WHERE role = 'hospital_staff';

-- Re-add flexible RBAC role check constraint
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'hospital_manager', 'hospital_staff', 'patient', 'citizen'));

ALTER TABLE users ADD CONSTRAINT users_hospital_manager_check
  CHECK (role NOT IN ('hospital_manager', 'hospital_staff') OR hospital_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_hospital_idx ON users (hospital_id);

-- Create preassigned_roles table for email-based role provisioning
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

-- Add reported_by_user_id to emergency_incidents
ALTER TABLE emergency_incidents
  ADD COLUMN IF NOT EXISTS reported_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS incidents_reported_by_idx ON emergency_incidents (reported_by_user_id);
`;

async function migrateAndSeed() {
  try {
    console.log("Applying users & authentication schema...");
    await db.query(schemaSql);
    console.log("✅ Users table and constraints updated.");

    // Fetch existing hospitals to associate managers
    const hospRes = await db.query(`SELECT id, name FROM hospitals ORDER BY id ASC`);
    const hospitals = hospRes.rows;

    const gmc = hospitals.find((h) => h.name.includes("Government Medical College") || h.name.includes("GMC"));
    const batra = hospitals.find((h) => h.name.includes("ASCOMS") || h.name.includes("Batra"));
    const apollo = hospitals.find((h) => h.name.includes("Apollo"));

    console.log("Seeding demo user accounts...");
    const saltRounds = 10;
    const adminHash = await bcrypt.hash("AdminPassword123!", saltRounds);
    const hospHash = await bcrypt.hash("HospitalPassword123!", saltRounds);
    const patientHash = await bcrypt.hash("PatientPassword123!", saltRounds);

    const demoUsers = [
      {
        name: "Central Dispatch Admin",
        email: "admin@medlink.org",
        passwordHash: adminHash,
        role: "admin",
        hospitalId: null,
        phone: "+91-9110000001"
      },
      {
        name: "Dr. Rajesh Gupta (GMC Triage Head)",
        email: "gmc.manager@medlink.org",
        passwordHash: hospHash,
        role: "hospital_manager",
        hospitalId: gmc ? gmc.id : null,
        phone: "+91-9110000002"
      },
      {
        name: "Suman Sharma (ASCOMS Batra Coordinator)",
        email: "batra.manager@medlink.org",
        passwordHash: hospHash,
        role: "hospital_manager",
        hospitalId: batra ? batra.id : null,
        phone: "+91-9110000003"
      },
      {
        name: "Dr. Ananya Sen (Apollo Emergency Lead)",
        email: "apollo.manager@medlink.org",
        passwordHash: hospHash,
        role: "hospital_manager",
        hospitalId: apollo ? apollo.id : null,
        phone: "+91-9110000004"
      },
      {
        name: "Amit Kumar (Citizen / Patient)",
        email: "patient@medlink.org",
        passwordHash: patientHash,
        role: "patient",
        hospitalId: null,
        phone: "+91-9876543210"
      }
    ];

    for (const u of demoUsers) {
      // If hospital manager and no hospital found, skip constraint issue
      if (['hospital_manager', 'hospital_staff'].includes(u.role) && !u.hospitalId) {
        continue;
      }

      await db.query(
        `INSERT INTO users (name, email, password_hash, role, hospital_id, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             hospital_id = EXCLUDED.hospital_id,
             phone = EXCLUDED.phone,
             updated_at = NOW()`,
        [u.name, u.email, u.passwordHash, u.role, u.hospitalId, u.phone]
      );
    }

    console.log("✅ Seeded demo accounts successfully:");
    console.log("  🛡️  Admin:            admin@medlink.org         / AdminPassword123!");
    console.log(`  🏥  GMC Manager:      gmc.manager@medlink.org   / HospitalPassword123! (Hospital #${gmc ? gmc.id : 'N/A'})`);
    console.log(`  🏥  Batra Manager:    batra.manager@medlink.org / HospitalPassword123! (Hospital #${batra ? batra.id : 'N/A'})`);
    console.log(`  🏥  Apollo Manager:   apollo.manager@medlink.org/ HospitalPassword123! (Hospital #${apollo ? apollo.id : 'N/A'})`);
    console.log("  👤  Patient:          patient@medlink.org       / PatientPassword123!");
  } catch (err) {
    console.error("❌ Auth migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

migrateAndSeed();
