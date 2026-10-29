/**
 * Migration: Blood Bank Registry & Doctor Shift Scheduling
 * 
 * 1. Creates `hospital_blood_inventory` table.
 * 2. Seeds blood groups for all hospitals (O-, O+, A+, B+, AB+, Platelets, FFP).
 * 3. Adds shift, doctor_name, on_duty, contact_phone columns to `hospital_specialists`.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

const sql = `
-- 1. Create hospital_blood_inventory table
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

-- 2. Add shift scheduling columns to hospital_specialists
ALTER TABLE hospital_specialists
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS shift VARCHAR(60) NOT NULL DEFAULT 'Morning (08:00 - 16:00)',
  ADD COLUMN IF NOT EXISTS on_duty BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30);
`;

const BLOOD_GROUPS = [
  { group: 'O- (Universal Red Cell)', defaultUnits: 6 },
  { group: 'O+ (Positive)', defaultUnits: 18 },
  { group: 'A+ (Positive)', defaultUnits: 14 },
  { group: 'A- (Negative)', defaultUnits: 5 },
  { group: 'B+ (Positive)', defaultUnits: 20 },
  { group: 'B- (Negative)', defaultUnits: 4 },
  { group: 'AB+ (Universal Plasma)', defaultUnits: 8 },
  { group: 'AB- (Negative)', defaultUnits: 3 },
  { group: 'Platelets (Apheresis)', defaultUnits: 10 },
  { group: 'Fresh Frozen Plasma (FFP)', defaultUnits: 15 }
];

async function run() {
  try {
    console.log("Applying blood inventory and specialist shift schema...");
    await db.query(sql);

    // Fetch existing hospitals
    const hospRes = await db.query(`SELECT id, name FROM hospitals`);
    console.log(`Seeding initial blood units for ${hospRes.rowCount} hospitals...`);

    for (const h of hospRes.rows) {
      for (const bg of BLOOD_GROUPS) {
        // Multiplier based on facility size
        const isTertiary = h.name.includes("Government") || h.name.includes("GMC");
        const units = isTertiary ? bg.defaultUnits * 2 : bg.defaultUnits;

        await db.query(
          `INSERT INTO hospital_blood_inventory (hospital_id, blood_group, units_available, status)
           VALUES ($1, $2, $3, 'available')
           ON CONFLICT (hospital_id, blood_group) DO UPDATE
           SET units_available = EXCLUDED.units_available, updated_at = NOW()`,
          [h.id, bg.group, units]
        );
      }
    }

    // Seed doctors with names and shifts for specialists if doctor_name is null
    await db.query(`
      UPDATE hospital_specialists
      SET doctor_name = CASE
            WHEN specialty LIKE '%Trauma%' THEN 'Dr. Arvind Sharma, MS (Trauma)'
            WHEN specialty LIKE '%Emergency%' THEN 'Dr. Priya Mahajan, MD (EM)'
            WHEN specialty LIKE '%Cardio%' THEN 'Dr. Sanjeev Koul, DM (Cardio)'
            WHEN specialty LIKE '%Neuro%' THEN 'Dr. Vivek Anand, MCh (Neuro)'
            WHEN specialty LIKE '%Ortho%' THEN 'Dr. Raman Gupta, MS (Ortho)'
            WHEN specialty LIKE '%Intensivist%' THEN 'Dr. Neha Verma, FNB (Critical Care)'
            ELSE 'Dr. Sunil Bhat, MD'
          END,
          shift = CASE
            WHEN id % 3 = 0 THEN 'Night (00:00 - 08:00)'
            WHEN id % 3 = 1 THEN 'Morning (08:00 - 16:00)'
            ELSE 'Evening (16:00 - 00:00)'
          END,
          contact_phone = '+91-94191-' || (10000 + (id * 37) % 90000)
      WHERE doctor_name IS NULL;
    `);

    console.log("✅ Blood bank registry and doctor shift schedules successfully initialized.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

run();
