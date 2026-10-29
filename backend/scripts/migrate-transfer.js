/**
 * Migration Script: Inter-Facility Transfer Support
 * Adds referring_hospital_id and transfer tracking to emergency_incidents,
 * and updates status check constraints to support secondary transfers.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

const sql = `
-- 1. Add transfer tracking columns to emergency_incidents
ALTER TABLE emergency_incidents
  ADD COLUMN IF NOT EXISTS referring_hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
  ADD COLUMN IF NOT EXISTS transfer_notes TEXT,
  ADD COLUMN IF NOT EXISTS transfer_urgency VARCHAR(30) DEFAULT 'urgent';

-- 2. Update status check constraint to include 'transferred' and 'transfer_requested'
ALTER TABLE emergency_incidents DROP CONSTRAINT IF EXISTS emergency_incidents_status_check;

ALTER TABLE emergency_incidents ADD CONSTRAINT emergency_incidents_status_check
  CHECK (status IN (
    'reported', 'assessing', 'dispatching', 'requested', 'accepted',
    'assigned', 'rejected', 'timed_out', 'escalated', 'en_route',
    'arrived', 'closed', 'cancelled', 'exhausted',
    'transfer_requested', 'transferred'
  ));

-- 3. Update incident_dispatch_logs status constraint to allow 'transferred'
ALTER TABLE incident_dispatch_logs DROP CONSTRAINT IF EXISTS incident_dispatch_logs_status_check;

ALTER TABLE incident_dispatch_logs ADD CONSTRAINT incident_dispatch_logs_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'timed_out', 'cancelled', 'transferred'));

-- 4. Create index for fast lookup of referring hospital transfers
CREATE INDEX IF NOT EXISTS incidents_referring_hospital_idx ON emergency_incidents (referring_hospital_id);
`;

async function migrate() {
  try {
    console.log("Applying Inter-Facility Transfer database migrations...");
    await db.query(sql);
    console.log("✅ Inter-Facility Transfer migrations applied successfully:");
    console.log("  - Added referring_hospital_id, transfer_reason, transfer_notes, transfer_urgency columns.");
    console.log("  - Updated status check constraints on emergency_incidents and incident_dispatch_logs.");
    console.log("  - Created index on referring_hospital_id.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

migrate();
