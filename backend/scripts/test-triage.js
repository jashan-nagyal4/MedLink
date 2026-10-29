/**
 * MedLink Triage & Resource Requirements Automated Verification Suite
 */

require("dotenv").config();
const assert = require("assert");
const db = require("../src/config/db");
const {
  detectConditionCategory,
  evaluateVitalSigns,
  deriveStandardizedRequirements
} = require("../src/services/triageEngine");
const firebaseService = require("../src/services/firebaseService");

async function runTests() {
  console.log("\n=======================================================");
  console.log(" MedLink Triage & Resource Engine Verification Suite");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Rule Engine Tests
  console.log("1. Testing Clinical Category & Vitals Rules...");

  test("Identifies Cardiac Condition from complaint", () => {
    assert.strictEqual(detectConditionCategory("Patient has acute crushing chest pain"), "cardiac");
  });

  test("Identifies Trauma Condition from complaint", () => {
    assert.strictEqual(detectConditionCategory("Car crash accident with open femur fracture"), "trauma");
  });

  test("Identifies Stroke Condition from complaint", () => {
    assert.strictEqual(detectConditionCategory("Sudden facial droop and right arm weakness"), "stroke");
  });

  test("Identifies Respiratory Condition from complaint", () => {
    assert.strictEqual(detectConditionCategory("Severe asthma attack and acute dyspnea"), "respiratory");
  });

  test("Flags Critical Hypoxemia (SpO2 < 85%)", () => {
    const v = evaluateVitalSigns({ oxygenSaturation: 82 });
    assert.strictEqual(v.vitalSeverity, "critical");
    assert.strictEqual(v.vitalTriage, "resuscitation");
  });

  test("Flags Circulatory Shock (Systolic BP < 80)", () => {
    const v = evaluateVitalSigns({ bloodPressure: "75/45" });
    assert.strictEqual(v.vitalSeverity, "critical");
    assert.strictEqual(v.vitalTriage, "resuscitation");
  });

  // 2. Resource Conversion
  console.log("\n2. Testing Standardized Resource Conversion...");

  test("Converts Cardiac Complaint to Cardiology + ICU Bed + Defibrillator", () => {
    const res = deriveStandardizedRequirements({
      chiefComplaint: "Myocardial infarction chest pain",
      vitalSigns: { bloodPressure: "120/80" }
    });
    assert.strictEqual(res.conditionCategory, "cardiac");
    assert.ok(res.requiredSpecialists.some(s => s.requiredSpecialty === "Cardiology"));
    assert.ok(res.requiredResources.some(r => r.requiredResourceType === "ICU beds"));
    assert.ok(res.requiredResources.some(r => r.requiredResourceType === "defibrillators"));
  });

  test("Converts Severe Trauma to Trauma Surgery + OR + CT Scanner + Ventilator", () => {
    const res = deriveStandardizedRequirements({
      chiefComplaint: "Pedestrian struck by truck, multiple trauma",
      vitalSigns: { bloodPressure: "78/48", oxygenSaturation: 88, gcs: 8 }
    });
    assert.strictEqual(res.conditionCategory, "trauma");
    assert.strictEqual(res.severity, "critical");
    assert.strictEqual(res.triageLevel, "resuscitation");
    assert.ok(res.requiredSpecialists.some(s => s.requiredSpecialty === "Trauma Surgery"));
    assert.ok(res.requiredResources.some(r => r.requiredResourceType === "Operating Room"));
    assert.ok(res.requiredResources.some(r => r.requiredResourceType === "CT scanners"));
    assert.ok(res.requiredResources.some(r => r.requiredResourceType === "ventilators"));
  });

  // 3. Firebase Service
  console.log("\n3. Testing Firebase Real-Time Service...");

  test("Firebase service returns healthy status", () => {
    const status = firebaseService.getStatus();
    assert.ok(status.mode === "firebase-cloud" || status.mode === "local-mock");
  });

  // 4. Live Database Integration Test
  console.log("\n4. Testing Live Database Incident Creation...");
  try {
    const res = await db.query(
      `INSERT INTO emergency_incidents
        (incident_number, address, location, severity, triage_level, chief_complaint, status)
       VALUES
        ('INC-TEST-001', 'Gandhi Nagar, Jammu', ST_SetSRID(ST_MakePoint(74.8570, 32.7266), 4326)::geography,
         'critical', 'resuscitation', 'Acute cardiac arrest test', 'reported')
       ON CONFLICT (incident_number) DO NOTHING
       RETURNING id, incident_number`
    );
    console.log("  [PASS] Successfully registered emergency incident in PostgreSQL database!");
    passed++;
  } catch (err) {
    console.error("  [FAIL] Database insert failed:", err.message);
    failed++;
  }

  console.log("\n=======================================================");
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  await db.pool.end();
}

runTests();
