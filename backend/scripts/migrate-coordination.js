/**
 * Dispatch Coordination & FSM Database Migration Script
 * Adds incident_dispatch_logs table, updates emergency_incidents status constraints,
 * and adds escalation tracking columns for the Finite State Machine (FSM).
 */

require("dotenv").config();
const db = require("../src/config/db");

const sql = `
-- 1. Update status CHECK constraint on emergency_incidents to support full FSM lifecycle
ALTER TABLE emergency_incidents DROP CONSTRAINT IF EXISTS emergency_incidents_status_check;

ALTER TABLE emergency_incidents ADD CONSTRAINT emergency_incidents_status_check
  CHECK (status IN (
    'reported', 'assessing', 'dispatching', 'requested', 'accepted',
    'assigned', 'rejected', 'timed_out', 'escalated', 'en_route',
    'arrived', 'closed', 'cancelled', 'exhausted'
  ));

-- 2. Add escalation tracking columns to emergency_incidents if not already present
ALTER TABLE emergency_incidents
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_dispatch_hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL;

-- 3. Create incident_dispatch_logs table for audit trail & timeout tracking
CREATE TABLE IF NOT EXISTS incident_dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL DEFAULT 1,
  match_score NUMERIC(5, 2),
  distance_km NUMERIC(6, 2),
  travel_time_minutes INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'timed_out', 'cancelled')),
  timeout_seconds INTEGER NOT NULL DEFAULT 45,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  response_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dispatch_logs_incident_idx ON incident_dispatch_logs (incident_id);
CREATE INDEX IF NOT EXISTS dispatch_logs_hospital_idx ON incident_dispatch_logs (hospital_id);
CREATE INDEX IF NOT EXISTS dispatch_logs_status_idx ON incident_dispatch_logs (status);

-- Ensure travel_time_minutes accepts decimal values (e.g. 12.2)
ALTER TABLE incident_dispatch_logs ALTER COLUMN travel_time_minutes TYPE NUMERIC(5, 1);
`;

async function migrate() {
  try {
    console.log("Applying coordination and dispatch database migrations...");
    await db.query(sql);
    console.log("✅ Coordination migrations applied successfully:");
    console.log("  - Updated emergency_incidents status check constraint with FSM states.");
    console.log("  - Added escalation_level & current_dispatch_hospital_id columns.");
    console.log("  - Created incident_dispatch_logs table with indexes.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

migrate();
