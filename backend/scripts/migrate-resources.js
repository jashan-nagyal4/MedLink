/**
 * Emergency Resources & Incidents Database Migration Script
 * Adds tables for patients, emergency_incidents, and incident_resource_requirements.
 */

require("dotenv").config();
const db = require("../src/config/db");

const sql = `
CREATE TABLE IF NOT EXISTS patients (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL DEFAULT 'Unknown / Unidentified',
  age INTEGER CHECK (age >= 0 AND age <= 150),
  gender VARCHAR(20) DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  contact_number VARCHAR(30),
  medical_history TEXT,
  allergies TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_incidents (
  id BIGSERIAL PRIMARY KEY,
  incident_number VARCHAR(64) UNIQUE NOT NULL,
  caller_name VARCHAR(120),
  caller_phone VARCHAR(30),
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  triage_level VARCHAR(30) NOT NULL DEFAULT 'urgent'
    CHECK (triage_level IN ('resuscitation', 'emergency', 'urgent', 'semi-urgent', 'non-urgent')),
  chief_complaint TEXT NOT NULL,
  condition_category VARCHAR(60) NOT NULL DEFAULT 'general'
    CHECK (condition_category IN ('cardiac', 'trauma', 'respiratory', 'stroke', 'burns', 'pediatric', 'obstetric', 'general', 'other')),
  vital_signs JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'assessing', 'dispatching', 'assigned', 'en_route', 'arrived', 'closed', 'cancelled')),
  assigned_hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incidents_location_gix ON emergency_incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON emergency_incidents (status);
CREATE INDEX IF NOT EXISTS incidents_severity_idx ON emergency_incidents (severity);
CREATE INDEX IF NOT EXISTS incidents_assigned_hospital_idx ON emergency_incidents (assigned_hospital_id);

CREATE TABLE IF NOT EXISTS incident_resource_requirements (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  required_resource_type VARCHAR(80),
  required_quantity INTEGER NOT NULL DEFAULT 1 CHECK (required_quantity >= 1),
  required_specialty VARCHAR(100),
  specialist_count INTEGER NOT NULL DEFAULT 1 CHECK (specialist_count >= 1),
  priority VARCHAR(20) NOT NULL DEFAULT 'mandatory'
    CHECK (priority IN ('mandatory', 'preferred', 'optional')),
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS incident_reqs_incident_idx ON incident_resource_requirements (incident_id);
`;

async function migrate() {
  try {
    console.log("Applying emergency incident and resources database migrations...");
    await db.query(sql);
    console.log("✅ Tables created successfully: patients, emergency_incidents, incident_resource_requirements.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

migrate();
