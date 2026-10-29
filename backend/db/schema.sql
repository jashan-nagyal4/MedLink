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
  department VARCHAR(100),
  specialty VARCHAR(100) NOT NULL,
  doctor_name VARCHAR(120),
  shift VARCHAR(60) NOT NULL DEFAULT 'Morning (08:00 - 16:00)',
  on_duty BOOLEAN NOT NULL DEFAULT true,
  contact_phone VARCHAR(30),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  count_available INTEGER NOT NULL DEFAULT 1 CHECK (count_available >= 0),
  duty_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    CHECK (status IN (
      'reported', 'assessing', 'dispatching', 'requested', 'accepted',
      'assigned', 'rejected', 'timed_out', 'escalated', 'en_route',
      'arrived', 'closed', 'cancelled', 'exhausted'
    )),
  assigned_hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  current_dispatch_hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  reported_by_user_id BIGINT,
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

-- 7. Users & Role Access Management
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'patient'
    CHECK (role IN ('admin', 'hospital_manager', 'hospital_staff', 'patient', 'citizen')),
  hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  phone VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_hospital_idx ON users (hospital_id);

-- 8. Pre-assigned Roles
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

-- 9. Hospital Blood Bank & Component Inventory
CREATE TABLE IF NOT EXISTS hospital_blood_inventory (
  id BIGSERIAL PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  blood_group VARCHAR(30) NOT NULL,
  units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, blood_group)
);

CREATE INDEX IF NOT EXISTS blood_inv_hospital_idx ON hospital_blood_inventory (hospital_id);

-- 10. Real-time Incident Dispatch Logs & FSM Audit Trail
CREATE TABLE IF NOT EXISTS incident_dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES emergency_incidents(id) ON DELETE CASCADE,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL DEFAULT 1,
  match_score NUMERIC(5, 2),
  distance_km NUMERIC(6, 2),
  travel_time_minutes NUMERIC(5, 1),
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

-- 11. Inter-Hospital Patient Transfers
CREATE TABLE IF NOT EXISTS patient_transfers (
  id BIGSERIAL PRIMARY KEY,
  source_hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  target_hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name VARCHAR(120),
  condition_category VARCHAR(60),
  severity VARCHAR(30),
  specialty_needed VARCHAR(100),
  equipment_needed VARCHAR(100),
  transfer_reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'declined', 'in_transit', 'completed', 'cancelled')),
  requested_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  responded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  response_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transfers_source_hosp_idx ON patient_transfers (source_hospital_id);
CREATE INDEX IF NOT EXISTS transfers_target_hosp_idx ON patient_transfers (target_hospital_id);
CREATE INDEX IF NOT EXISTS transfers_status_idx ON patient_transfers (status);
