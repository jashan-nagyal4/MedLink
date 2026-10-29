/**
 * Migration & Equipment Category Alignment Script
 * 
 * Ensures all registered hospitals have:
 * 1. Ventilator equipment (Mechanical Ventilator / ventilators)
 * 2. Defibrillator equipment (Defibrillator Unit / defibrillators)
 * 
 * Verified against automated triage requirements for:
 * - Cardiac emergencies -> requires defibrillators
 * - Severe respiratory distress & hypoxemia -> requires ventilators
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

async function run() {
  console.log("Aligning hospital equipment categories for Defibrillators & Ventilators...");

  const hospitalsRes = await db.query("SELECT id, name FROM hospitals");
  console.log(`Found ${hospitalsRes.rowCount} hospitals.`);

  for (const hosp of hospitalsRes.rows) {
    const resList = await db.query(
      "SELECT id, resource_type, available_quantity, total_quantity FROM hospital_resources WHERE hospital_id = $1",
      [hosp.id]
    );

    const types = resList.rows.map(r => r.resource_type.toLowerCase());
    const hasVentilator = types.some(t => t.includes("ventilator"));
    const hasDefibrillator = types.some(t => t.includes("defibrillator"));

    if (!hasVentilator) {
      console.log(`  + Adding 'Mechanical Ventilator' to ${hosp.name}`);
      await db.query(
        `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes)
         VALUES ($1, 'Mechanical Ventilator', 15, 8, 'available', 'ICU-grade mechanical ventilatory support')
         ON CONFLICT (hospital_id, resource_type) DO UPDATE SET available_quantity = EXCLUDED.available_quantity`,
        [hosp.id]
      );
    } else {
      console.log(`  ✓ ${hosp.name} already has ventilator equipment`);
    }

    if (!hasDefibrillator) {
      console.log(`  + Adding 'Defibrillator Unit' to ${hosp.name}`);
      await db.query(
        `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes)
         VALUES ($1, 'Defibrillator Unit', 8, 5, 'available', 'Biphasic defibrillator with external pacing')
         ON CONFLICT (hospital_id, resource_type) DO UPDATE SET available_quantity = EXCLUDED.available_quantity`,
        [hosp.id]
      );
    } else {
      console.log(`  ✓ ${hosp.name} already has defibrillator equipment`);
    }
  }

  console.log("Equipment alignment completed successfully!");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
