/**
 * Automated Verification Script for Batch 2 Features:
 * 1. Blood Bank & Plasma Inventory Registry
 * 2. Central Dispatch Analytics & Capacity Surge Dashboard
 * 3. Doctor On-Duty Shift Scheduler
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

async function runBatch2Tests() {
  console.log("===============================================================");
  console.log("  MedLink Batch 2 Features Verification (Blood, Analytics, Shifts)  ");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. Verify Blood Inventory Table & Seeding (Feature 1)
    // -------------------------------------------------------------
    console.log("1. Testing Emergency Blood Bank & Plasma Registry...");

    const bloodCountRes = await db.query(`SELECT COUNT(*) FROM hospital_blood_inventory`);
    const totalBloodRecords = parseInt(bloodCountRes.rows[0].count, 10);
    assert(totalBloodRecords >= 50, `Blood inventory seeded across hospitals (found ${totalBloodRecords} records, expected >= 50)`);

    // Fetch inventory for Hospital 1 (GMC Jammu)
    const gmcBloodRes = await db.query(
      `SELECT blood_group, units_available, status FROM hospital_blood_inventory WHERE hospital_id = 1 ORDER BY blood_group`
    );
    assert(gmcBloodRes.rowCount === 10, `GMC Jammu has full 10 blood groups / components registered`);

    const universalDonor = gmcBloodRes.rows.find((r) => r.blood_group.includes("O-"));
    assert(universalDonor !== undefined, `Universal donor O- blood group registered`);
    assert(universalDonor.units_available >= 0, `O- blood units are numeric (${universalDonor.units_available})`);

    // Test Blood inventory update / upsert
    const testBloodGroup = universalDonor.blood_group;
    const initialUnits = universalDonor.units_available;
    const updatedUnits = initialUnits + 5;

    await db.query(
      `INSERT INTO hospital_blood_inventory (hospital_id, blood_group, units_available, status, updated_at)
       VALUES (1, $1, $2, 'adequate', CURRENT_TIMESTAMP)
       ON CONFLICT (hospital_id, blood_group)
       DO UPDATE SET units_available = EXCLUDED.units_available, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP`,
      [testBloodGroup, updatedUnits]
    );

    const verifyBloodUpdate = await db.query(
      `SELECT units_available, status FROM hospital_blood_inventory WHERE hospital_id = 1 AND blood_group = $1`,
      [testBloodGroup]
    );
    assert(verifyBloodUpdate.rows[0].units_available === updatedUnits, `Blood inventory unit increment verified via ON CONFLICT UPSERT`);

    // Revert back
    await db.query(
      `UPDATE hospital_blood_inventory SET units_available = $1 WHERE hospital_id = 1 AND blood_group = $2`,
      [initialUnits, testBloodGroup]
    );
    console.log("  ✅ Blood inventory update and rollback verified cleanly.");

    // -------------------------------------------------------------
    // 2. Testing Doctor On-Duty Shift Scheduler (Feature 5)
    // -------------------------------------------------------------
    console.log("\n2. Testing Doctor On-Duty Shift Scheduler & Specialist Roster...");

    // Check schema columns
    const specColsRes = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'hospital_specialists' 
      AND column_name IN ('doctor_name', 'shift', 'on_duty', 'contact_phone')
    `);
    const foundCols = specColsRes.rows.map((r) => r.column_name);
    assert(foundCols.includes("doctor_name"), `hospital_specialists has 'doctor_name' column`);
    assert(foundCols.includes("shift"), `hospital_specialists has 'shift' column`);
    assert(foundCols.includes("on_duty"), `hospital_specialists has 'on_duty' column`);
    assert(foundCols.includes("contact_phone"), `hospital_specialists has 'contact_phone' column`);

    // Insert a new specialist doctor with shift info
    const insertDocRes = await db.query(
      `INSERT INTO hospital_specialists (hospital_id, specialty, available, count_available, duty_notes, doctor_name, shift, on_duty, contact_phone)
       VALUES (1, 'Trauma Surgery', true, 1, 'Night emergency lead', 'Dr. Vikram Malhotra', 'Night (00:00 - 08:00)', true, '+91 94191 99999')
       RETURNING id, doctor_name, shift, on_duty, contact_phone`
    );
    const newDoc = insertDocRes.rows[0];
    assert(newDoc.doctor_name === "Dr. Vikram Malhotra", `Doctor name stored properly: ${newDoc.doctor_name}`);
    assert(newDoc.shift === "Night (00:00 - 08:00)", `Doctor shift stored properly: ${newDoc.shift}`);
    assert(newDoc.on_duty === true, `Doctor initial on_duty state is true`);

    // Test toggle duty
    const toggleRes = await db.query(
      `UPDATE hospital_specialists
       SET on_duty = NOT on_duty, available = NOT available, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, on_duty, available`,
      [newDoc.id]
    );
    assert(toggleRes.rows[0].on_duty === false, `1-Click Duty toggle set doctor to off-duty`);
    assert(toggleRes.rows[0].available === false, `Availability synced with duty state`);

    // Cleanup test doctor
    await db.query(`DELETE FROM hospital_specialists WHERE id = $1`, [newDoc.id]);
    console.log("  ✅ Doctor shift scheduler database lifecycle verified cleanly.");

    // -------------------------------------------------------------
    // 3. Testing Central Dispatch Analytics & Capacity Surge (Feature 2)
    // -------------------------------------------------------------
    console.log("\n3. Testing Central Dispatch Analytics & Capacity Surge Metrics...");

    // Test ICU saturation calculation query
    const icuQuery = await db.query(`
      SELECT 
        COALESCE(SUM(total_quantity), 0) AS total_icu,
        COALESCE(SUM(available_quantity), 0) AS available_icu
      FROM hospital_resources
      WHERE resource_type ILIKE '%ICU%'
    `);
    const totalIcu = parseInt(icuQuery.rows[0].total_icu, 10);
    const availableIcu = parseInt(icuQuery.rows[0].available_icu, 10);
    const occupiedIcu = totalIcu - availableIcu;
    const icuOccupancyPct = totalIcu > 0 ? Math.round((occupiedIcu / totalIcu) * 100) : 0;
    assert(totalIcu > 0, `Regional ICU bed capacity counted (${totalIcu} total beds, ${availableIcu} open)`);
    assert(icuOccupancyPct >= 0 && icuOccupancyPct <= 100, `Regional ICU occupancy percentage calculated (${icuOccupancyPct}%)`);

    // Test Hospital Surge Pressure Matrix query
    const surgeQuery = await db.query(`
      SELECT 
        h.id,
        h.name,
        h.operational_status,
        COALESCE(SUM(hr.total_quantity), 0) AS total_capacity,
        COALESCE(SUM(hr.available_quantity), 0) AS available_capacity,
        COUNT(DISTINCT hs.id) FILTER (WHERE hs.on_duty = true OR hs.available = true) AS doctors_on_duty,
        COUNT(DISTINCT ei.id) FILTER (WHERE ei.status IN ('allocated', 'in_transit')) AS active_inbound
      FROM hospitals h
      LEFT JOIN hospital_resources hr ON hr.hospital_id = h.id
      LEFT JOIN hospital_specialists hs ON hs.hospital_id = h.id
      LEFT JOIN emergency_incidents ei ON ei.assigned_hospital_id = h.id
      GROUP BY h.id, h.name, h.operational_status
      ORDER BY h.id
    `);
    assert(surgeQuery.rowCount >= 5, `Surge Matrix generated across regional facilities (${surgeQuery.rowCount} hospitals)`);
    const gmcSurge = surgeQuery.rows.find((r) => Number(r.id) === 1) || surgeQuery.rows[0];
    assert(parseInt(gmcSurge.total_capacity, 10) > 0, `Hospital capacity metrics computed for ${gmcSurge.name}`);
    assert(parseInt(gmcSurge.doctors_on_duty, 10) >= 0, `Active on-duty doctors counted for ${gmcSurge.name} (${gmcSurge.doctors_on_duty})`);

    // Test Regional Blood Reserves aggregation
    const bloodReservesQuery = await db.query(`
      SELECT 
        blood_group,
        SUM(units_available) AS total_units,
        COUNT(DISTINCT hospital_id) AS reporting_hospitals
      FROM hospital_blood_inventory
      GROUP BY blood_group
      ORDER BY blood_group
    `);
    assert(bloodReservesQuery.rowCount === 10, `All 10 blood components aggregated regionally`);
    const universalRegional = bloodReservesQuery.rows.find((r) => r.blood_group.includes("O-"));
    assert(parseInt(universalRegional.total_units, 10) > 0, `Regional O- reserves summed (${universalRegional.total_units} units)`);

    // Test Audit Log CSV export data query
    const auditIncidentsQuery = await db.query(`
      SELECT 
        ei.id,
        ei.incident_number,
        ei.condition_category,
        ei.severity,
        ei.status,
        ei.address,
        h.name AS assigned_hospital,
        p.name AS patient_name,
        ei.created_at,
        ei.updated_at
      FROM emergency_incidents ei
      LEFT JOIN hospitals h ON ei.assigned_hospital_id = h.id
      LEFT JOIN patients p ON ei.patient_id = p.id
      ORDER BY ei.created_at DESC
      LIMIT 10
    `);
    assert(auditIncidentsQuery.rows !== undefined, `Audit incidents export query executed successfully`);

    console.log("\n===============================================================");
    console.log(`  ALL ${passed}/${total} BATCH 2 VERIFICATION TESTS PASSED!  `);
    console.log("===============================================================");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

runBatch2Tests();
