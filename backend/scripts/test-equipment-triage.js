/**
 * Verification Test: Defibrillator and Ventilator Triage Recognition
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const assert = require("assert");
const db = require("../src/config/db");
const {
  doesResourceMatch,
  normalizeResourceCategory,
  doesSpecialtyMatch,
  normalizeSpecialty,
  rankHospitalsForIncident
} = require("../src/services/hospitalMatcher");
const { deriveStandardizedRequirements } = require("../src/services/triageEngine");

async function run() {
  console.log("\n=======================================================");
  console.log(" MedLink Defibrillator & Ventilator Triage Suite");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Equipment Normalization & Matching Logic
  console.log("1. Testing Clinical Equipment Canonical Normalization...");

  test("Normalizes Defibrillator variations to 'defibrillators'", () => {
    assert.strictEqual(normalizeResourceCategory("Defibrillator Unit"), "defibrillators");
    assert.strictEqual(normalizeResourceCategory("Defibrillator"), "defibrillators");
    assert.strictEqual(normalizeResourceCategory("Biphasic Defibrillator"), "defibrillators");
    assert.strictEqual(normalizeResourceCategory("Automated External Defibrillator (AED)"), "defibrillators");
  });

  test("Normalizes Ventilator variations to 'ventilators'", () => {
    assert.strictEqual(normalizeResourceCategory("Mechanical Ventilator"), "ventilators");
    assert.strictEqual(normalizeResourceCategory("Ventilator"), "ventilators");
    assert.strictEqual(normalizeResourceCategory("ICU Ventilator (Invasive)"), "ventilators");
    assert.strictEqual(normalizeResourceCategory("ventilators"), "ventilators");
  });

  test("doesResourceMatch recognizes 'Defibrillator Unit' for triage requirement 'defibrillators'", () => {
    assert.strictEqual(doesResourceMatch("Defibrillator Unit", "defibrillators"), true);
    assert.strictEqual(doesResourceMatch("Defibrillator", "defibrillators"), true);
    assert.strictEqual(doesResourceMatch("defibrillators", "defibrillators"), true);
  });

  test("doesResourceMatch recognizes 'Mechanical Ventilator' for triage requirement 'ventilators'", () => {
    assert.strictEqual(doesResourceMatch("Mechanical Ventilator", "ventilators"), true);
    assert.strictEqual(doesResourceMatch("Ventilator", "ventilators"), true);
    assert.strictEqual(doesResourceMatch("ventilators", "ventilators"), true);
  });

  test("doesResourceMatch recognizes 'ICU Bed' for triage requirement 'ICU beds'", () => {
    assert.strictEqual(doesResourceMatch("ICU Bed", "ICU beds"), true);
    assert.strictEqual(doesResourceMatch("Pediatric ICU Bed", "Pediatric ICU beds"), true);
  });

  // 2. Doctor Specialty Matching Logic
  console.log("\n2. Testing Specialist Title to Department Matching...");

  test("doesSpecialtyMatch recognizes 'Cardiologist' for requirement 'Cardiology'", () => {
    assert.strictEqual(doesSpecialtyMatch("Cardiologist", "Cardiology"), true);
  });

  test("doesSpecialtyMatch recognizes 'Trauma Surgeon' for requirement 'Trauma Surgery'", () => {
    assert.strictEqual(doesSpecialtyMatch("Trauma Surgeon", "Trauma Surgery"), true);
  });

  test("doesSpecialtyMatch recognizes 'Pulmonologist' for requirement 'Pulmonology'", () => {
    assert.strictEqual(doesSpecialtyMatch("Pulmonologist", "Pulmonology"), true);
  });

  // 3. Triage Engine Generation Verification
  console.log("\n3. Testing Triage Engine Clinical Conversions...");

  test("Cardiac complaint converts to defibrillators requirement", () => {
    const triage = deriveStandardizedRequirements({
      chiefComplaint: "Severe crushing retrosternal chest pain radiating to left arm",
      conditionCategory: "cardiac"
    });
    assert.ok(triage.requiredResources.some(r => r.requiredResourceType === "defibrillators"));
  });

  test("Respiratory complaint converts to ventilators requirement", () => {
    const triage = deriveStandardizedRequirements({
      chiefComplaint: "Acute respiratory failure with gasping and cyanosis",
      conditionCategory: "respiratory",
      vitalSigns: { oxygenSaturation: 82 }
    });
    assert.ok(triage.requiredResources.some(r => r.requiredResourceType === "ventilators"));
  });

  // 4. Live Database Matching Verification
  console.log("\n4. Testing Live Database Matching with GMC Jammu & Regional Facilities...");

  try {
    // Insert a test cardiac & respiratory incident
    const incRes = await db.query(
      `INSERT INTO emergency_incidents
        (incident_number, address, location, severity, triage_level, chief_complaint, condition_category, status)
       VALUES
        ('INC-EQUIP-TEST', 'Bakshi Nagar, Jammu', ST_SetSRID(ST_MakePoint(74.8458, 32.7426), 4326)::geography,
         'critical', 'resuscitation', 'Cardiac arrest and ventilatory compromise', 'cardiac', 'reported')
       ON CONFLICT (incident_number) DO UPDATE SET updated_at = NOW()
       RETURNING id`
    );
    const incId = incRes.rows[0].id;

    // Insert both defibrillator and ventilator requirements
    await db.query(`DELETE FROM incident_resource_requirements WHERE incident_id = $1`, [incId]);
    await db.query(
      `INSERT INTO incident_resource_requirements
        (incident_id, required_resource_type, required_quantity, priority, justification)
       VALUES
        ($1, 'defibrillators', 1, 'mandatory', 'Cardiac defibrillation required'),
        ($1, 'ventilators', 1, 'mandatory', 'Mechanical ventilation required')`,
      [incId]
    );

    const matchResult = await rankHospitalsForIncident(incId, 30000);
    assert.ok(matchResult.rankedHospitals.length > 0, "Candidate hospitals returned");

    // Check GMC Jammu (or first hospital) matched resources
    const gmc = matchResult.rankedHospitals.find(h => h.name.includes("GMC") || h.name.includes("Government"));
    assert.ok(gmc, "GMC Jammu found in ranked hospitals");

    const defibMatch = gmc.matchedResources.find(r => r.resourceType === "defibrillators");
    assert.ok(defibMatch, "defibrillators requirement matched");
    assert.strictEqual(defibMatch.satisfied, true, `Defibrillator should be satisfied, available: ${defibMatch.availableQty}`);
    assert.ok(defibMatch.availableQty > 0, `Available Defibrillators: ${defibMatch.availableQty}`);

    const ventMatch = gmc.matchedResources.find(r => r.resourceType === "ventilators");
    assert.ok(ventMatch, "ventilators requirement matched");
    assert.strictEqual(ventMatch.satisfied, true, `Ventilator should be satisfied, available: ${ventMatch.availableQty}`);
    assert.ok(ventMatch.availableQty > 0, `Available Ventilators: ${ventMatch.availableQty}`);

    console.log(`  ✅ [PASS] Live DB Matching: GMC Jammu Defibrillators (${defibMatch.availableQty} available via '${defibMatch.matchedFacilityResource}') recognized as satisfied!`);
    console.log(`  ✅ [PASS] Live DB Matching: GMC Jammu Ventilators (${ventMatch.availableQty} available via '${ventMatch.matchedFacilityResource}') recognized as satisfied!`);
    passed += 2;

    // Clean up test incident
    await db.query(`DELETE FROM incident_resource_requirements WHERE incident_id = $1`, [incId]);
    await db.query(`DELETE FROM emergency_incidents WHERE id = $1`, [incId]);

  } catch (err) {
    console.error(`  ❌ [FAIL] Live DB Matching error:`, err);
    failed++;
  }

  console.log("\n=======================================================");
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
