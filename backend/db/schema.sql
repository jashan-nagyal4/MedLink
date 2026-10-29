-- Enable the PostGIS extension for handling Earth GPS coordinates
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(254),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  operational_status VARCHAR(20) NOT NULL DEFAULT 'operational'
    CHECK (operational_status IN ('operational', 'limited', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast spatial index so PostGIS can search millions of coordinates in milliseconds
CREATE INDEX IF NOT EXISTS hospitals_location_gix ON hospitals USING GIST (location);

-- 2. Hospital Resources (Beds, Ventilators, Scanners)
CREATE TABLE IF NOT EXISTS hospital_resources (
  id BIGSERIAL PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  resource_type VARCHAR(80) NOT NULL,
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL CHECK (
    available_quantity >= 0 AND available_quantity <= total_quantity
  ),
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'limited', 'unavailable', 'maintenance')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, resource_type)
);

CREATE INDEX IF NOT EXISTS hospital_resources_hospital_idx ON hospital_resources (hospital_id);

-- 3. Hospital Specialists (Doctors on Duty)
CREATE TABLE IF NOT EXISTS hospital_specialists (
  id BIGSERIAL PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  specialty VARCHAR(100) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  count_available INTEGER NOT NULL DEFAULT 0 CHECK (count_available >= 0),
  duty_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, specialty)
);

CREATE INDEX IF NOT EXISTS hospital_specialists_hospital_idx ON hospital_specialists (hospital_id);


-- ========================================================
-- Emergency Incident and Patient Data
-- ========================================================

-- 4. Patients Table (Emergency victims)
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

-- 5. Emergency Incidents Table
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

-- 6. Incident Resource Requirements Table (Derived medical requirements)
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
