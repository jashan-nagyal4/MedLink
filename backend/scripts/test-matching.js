/**
 * Automated Verification Suite
 * Validates Geo-spatial Matching & Multi-Criteria Hospital Ranking
 */

require("dotenv").config();
const assert = require("assert");
const db = require("../src/config/db");
const {
  estimateTravelTimeMinutes,
  calculateProximityScore,
  calculateFreshnessScore,
  rankHospitalsForIncident
} = require("../src/services/hospitalMatcher");

async function runTests() {
  console.log("\n=======================================================");
  console.log(" MedLink Matching Engine Verification Suite (MCDM & PostGIS)");
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

  // 1. Travel Time Model
  console.log("1. Testing Travel Time & Transit Estimation...");

  test("Estimates travel time realistically (2 km = ~5.4 mins)", () => {
    const time = estimateTravelTimeMinutes(2000);
    assert.ok(time >= 4.0 && time <= 6.5, `Time was ${time}`);
  });

  test("Estimates travel time for 10 km = ~19.1 mins", () => {
    const time = estimateTravelTimeMinutes(10000);
    assert.ok(time >= 17.0 && time <= 21.0, `Time was ${time}`);
  });

  // 2. Proximity Scoring
  console.log("\n2. Testing Proximity Scoring Curves...");

  test("Gives 100 points for immediate proximity (<= 500m)", () => {
    const score = calculateProximityScore(300, 25000);
    assert.strictEqual(score, 100);
  });

  test("Decays score gracefully as distance increases", () => {
    const scoreClose = calculateProximityScore(2000, 25000);
    const scoreFar = calculateProximityScore(15000, 25000);
    assert.ok(scoreClose > scoreFar, `Close (${scoreClose}) should be > Far (${scoreFar})`);
  });

  // 3. Data Freshness
  console.log("\n3. Testing Data Freshness Scoring...");

  test("Gives full 100 points for updates within 1 hour", () => {
    const now = new Date();
    assert.strictEqual(calculateFreshnessScore(now), 100);
  });

  test("Penalizes stale records (> 12 hours old)", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const score = calculateFreshnessScore(yesterday);
    assert.strictEqual(score, 30);
  });

  // 4. End-to-End Live Database Matching
  console.log("\n4. Testing Live PostGIS Matching & MCDM Ranking in Database...");

  try {
    // 1. Insert a test cardiac incident in Jammu Center
    const incRes = await db.query(
      `INSERT INTO emergency_incidents
        (incident_number, address, location, severity, triage_level, chief_complaint, condition_category, status)
       VALUES
        ('INC-MATCH-TEST', 'Gandhi Nagar, Jammu', ST_SetSRID(ST_MakePoint(74.8570, 32.7266), 4326)::geography,
         'critical', 'resuscitation', 'Acute myocardial infarction with cardiogenic shock', 'cardiac', 'reported')
       ON CONFLICT (incident_number) DO UPDATE SET updated_at = NOW()
       RETURNING id`
    );
    const incidentId = incRes.rows[0].id;

    // 2. Add requirements for this incident (Cardiology + ICU beds)
    await db.query(
      `INSERT INTO incident_resource_requirements
        (incident_id, required_resource_type, required_quantity, priority)
       VALUES
        ($1, 'ICU beds', 1, 'mandatory'),
        ($1, 'ventilators', 1, 'mandatory')`,
      [incidentId]
    );

    await db.query(
      `INSERT INTO incident_resource_requirements
        (incident_id, required_specialty, specialist_count, priority)
       VALUES
        ($1, 'Cardiology', 1, 'mandatory')`,
      [incidentId]
    );

    // 3. Run MCDM Matching Engine
    const result = await rankHospitalsForIncident(incidentId, 25000);

    assert.ok(result.rankedHospitals.length > 0, "Must find candidate hospitals");
    console.log(`  [PASS] Successfully evaluated ${result.rankedHospitals.length} candidate hospitals!`);
    passed++;

    // Print top ranked hospital details
    const topHosp = result.rankedHospitals[0];
    console.log(`         🏆 Rank #1: ${topHosp.name}`);
    console.log(`         Distance: ${topHosp.distanceKm} km (Est. Travel: ${topHosp.estimatedTravelMinutes} mins)`);
    console.log(`         Composite Score: ${topHosp.compositeScore}/100 (Eligible: ${topHosp.isEligible})`);
    console.log(`         Rationale: ${topHosp.recommendationReason}`);

    assert.ok(topHosp.compositeScore > 0, "Score should be positive");
    assert.strictEqual(topHosp.rank, 1, "Top hospital has rank 1");
    console.log("  [PASS] Ranking order and composite scoring verified!");
    passed++;

  } catch (err) {
    console.error("  [FAIL] Live matching test failed:", err.message);
    failed++;
  }

  console.log("\n=======================================================");
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  await db.pool.end();
}

runTests();
