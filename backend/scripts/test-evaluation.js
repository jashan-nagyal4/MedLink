/**
 * Automated Verification Suite: Performance Evaluation & Documentation
 * 
 * Verifies:
 * 1. Triage Classification Metrics: Precision, Recall, F1-Score, Accuracy >= 90%
 * 2. 5x5 Confusion Matrix generation across all clinical acuity levels
 * 3. Latency Percentiles & SLA Adherence (Triage <= 15ms, Spatial <= 50ms, Matching <= 100ms)
 * 4. Synthetic Workload Benchmark: Throughput (OPS), P95 Latency, 1st Tier Matching
 * 5. Executive Summary API (Key metrics, operational facilities)
 * 6. Documentation API & Filesystem Deliverables (Final Report, User Manual, Presentation Deck)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const API_BASE = "http://localhost:4000/api/evaluation";

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    testsFailed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {}
    };

    const req = http.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (err) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runPerformanceTestSuite() {
  console.log("================================================================================");
  console.log("        MEDLINK: PERFORMANCE EVALUATION & SYSTEM VERIFICATION SUITE             ");
  console.log("================================================================================\n");

  try {
    // -------------------------------------------------------------------------
    // TEST GROUP 1: Physical Documentation Deliverables on Disk
    // -------------------------------------------------------------------------
    console.log("📂 TEST GROUP 1: Physical Technical Documentation Deliverables");
    const docsDir = path.resolve(__dirname, "../../docs");

    const reportPath = path.join(docsDir, "FINAL_PROJECT_REPORT.md");
    const manualPath = path.join(docsDir, "USER_DOCUMENTATION.md");
    const presentationPath = path.join(docsDir, "PRESENTATION_MATERIALS.md");

    assert(fs.existsSync(reportPath), "docs/FINAL_PROJECT_REPORT.md exists on disk");
    if (fs.existsSync(reportPath)) {
      const stats = fs.statSync(reportPath);
      assert(stats.size > 2000, `Final Project Report is detailed (${stats.size} bytes > 2KB)`);
      const content = fs.readFileSync(reportPath, "utf-8");
      assert(content.includes("Abstract"), "Final Report contains Executive Abstract");
      assert(content.includes("Mathematical and Algorithmic Formulations"), "Final Report contains Mathematical Formulations");
      assert(content.includes("Experimental Evaluation and Results"), "Final Report contains Empirical Evaluation & Confusion Matrix");
    }

    assert(fs.existsSync(manualPath), "docs/USER_DOCUMENTATION.md exists on disk");
    if (fs.existsSync(manualPath)) {
      const stats = fs.statSync(manualPath);
      assert(stats.size > 1500, `User Manual is detailed (${stats.size} bytes > 1.5KB)`);
      const content = fs.readFileSync(manualPath, "utf-8");
      assert(content.includes("Citizen & Emergency Caller Guide"), "User Manual covers Citizen Persona");
      assert(content.includes("CAD Emergency Dispatcher Guide"), "User Manual covers Dispatcher Persona");
      assert(content.includes("Hospital Triage Desk Officer"), "User Manual covers Hospital Personnel Persona");
    }

    assert(fs.existsSync(presentationPath), "docs/PRESENTATION_MATERIALS.md exists on disk");
    if (fs.existsSync(presentationPath)) {
      const stats = fs.statSync(presentationPath);
      assert(stats.size > 1500, `Presentation Materials are detailed (${stats.size} bytes > 1.5KB)`);
      const content = fs.readFileSync(presentationPath, "utf-8");
      assert(content.includes("Presentation Slide Deck Outline"), "Presentation Materials contain 12-Slide Deck Structure");
      assert(content.includes("Live Demonstration Walkthrough Script"), "Presentation Materials contain 5-Minute Viva Demo Script");
      assert(content.includes("Anticipated Viva Defense Q&A"), "Presentation Materials contain Anticipated Viva Defense Q&A");
    }

    // -------------------------------------------------------------------------
    // TEST GROUP 2: Triage Classification Metrics & Confusion Matrix
    // -------------------------------------------------------------------------
    console.log("\n📊 TEST GROUP 2: Triage Classification Metrics & Confusion Matrix");
    const metricsRes = await requestJson(`${API_BASE}/metrics`);
    assert(metricsRes.status === 200, "GET /api/evaluation/metrics returns HTTP 200 OK");
    assert(metricsRes.body.success === true, "Metrics API response indicates success: true");

    const cm = metricsRes.body.classificationMetrics;
    assert(cm && typeof cm === "object", "classificationMetrics object present in response");
    assert(cm.totalEvaluated === 21, `Evaluated full benchmark dataset of 21 clinical test cases (actual: ${cm.totalEvaluated})`);
    assert(cm.overallAccuracy >= 0.90, `Overall Triage Accuracy >= 90% (actual: ${(cm.overallAccuracy * 100).toFixed(1)}%)`);
    assert(cm.macroPrecision >= 0.90, `Macro Precision >= 0.90 (actual: ${cm.macroPrecision})`);
    assert(cm.macroRecall >= 0.90, `Macro Recall >= 0.90 (actual: ${cm.macroRecall})`);
    assert(cm.macroF1Score >= 0.90, `Macro F1-Score >= 0.90 (actual: ${cm.macroF1Score})`);

    // Verify all 5 Acuity Classes
    const expectedClasses = ["resuscitation", "emergency", "urgent", "semi-urgent", "non-urgent"];
    expectedClasses.forEach(c => {
      const p = cm.perClass[c];
      assert(p !== undefined, `Per-class evaluation present for '${c}'`);
      assert(p.precision >= 0.85, `'${c}' Precision >= 85% (actual: ${(p.precision * 100).toFixed(1)}%)`);
      assert(p.recall >= 0.85, `'${c}' Recall >= 85% (actual: ${(p.recall * 100).toFixed(1)}%)`);
      assert(p.f1Score >= 0.85, `'${c}' F1-Score >= 85% (actual: ${(p.f1Score * 100).toFixed(1)}%)`);
    });

    // Verify Confusion Matrix Integrity
    assert(cm.confusionMatrix !== undefined, "Confusion matrix object generated");
    assert(Object.keys(cm.confusionMatrix).length === 5, "Confusion matrix has 5 ground-truth rows");
    assert(cm.confusionMatrix.resuscitation.resuscitation === 4, "Resuscitation correctly classified 4/4");
    assert(cm.confusionMatrix.emergency.emergency === 6, "Emergency correctly classified 6/6");
    assert(cm.confusionMatrix.urgent.urgent === 6, "Urgent correctly classified 6/6");

    // -------------------------------------------------------------------------
    // TEST GROUP 3: Latency Percentiles & Subsystem SLAs
    // -------------------------------------------------------------------------
    console.log("\n⚡ TEST GROUP 3: Latency Percentiles & Subsystem SLA Adherence");
    const lat = metricsRes.body.latencyBenchmarks;
    assert(lat !== undefined, "latencyBenchmarks object present");
    assert(lat.triageInference && lat.triageInference.p95 !== undefined, "Triage inference latency percentiles computed");
    assert(lat.spatialPostGisQuery && lat.spatialPostGisQuery.p95 !== undefined, "PostGIS spatial latency percentiles computed");
    assert(lat.hospitalCapacityMatching && lat.hospitalCapacityMatching.p95 !== undefined, "Hospital MCDM matching latency computed");

    const sla = metricsRes.body.slaAdherence;
    assert(sla !== undefined, "slaAdherence object present");
    assert(sla.status === "ALL_SLA_PASSED", `SLA Overall Status is ALL_SLA_PASSED (actual: ${sla.status})`);
    assert(sla.checks.triageClassification.passed === true, `Triage Classification SLA passed (P95: ${lat.triageInference.p95}ms <= 15ms)`);
    assert(sla.checks.spatialProximitySearch.passed === true, `PostGIS Proximity SLA passed (P95: ${lat.spatialPostGisQuery.p95}ms <= 50ms)`);
    assert(sla.checks.multiResourceMatching.passed === true, `Hospital MCDM Matching SLA passed (P95: ${lat.hospitalCapacityMatching.p95}ms <= 100ms)`);
    assert(sla.checks.overallTriageAccuracy.passed === true, `Accuracy SLA passed (${(cm.overallAccuracy * 100).toFixed(1)}% >= 90%)`);

    // -------------------------------------------------------------------------
    // TEST GROUP 4: Synthetic Scalability & Throughput Benchmark
    // -------------------------------------------------------------------------
    console.log("\n📈 TEST GROUP 4: Dynamic Synthetic Workload Benchmark (50 Cases)");
    const syntheticRes = await requestJson(`${API_BASE}/run-synthetic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { count: 50 }
    });

    assert(syntheticRes.status === 200, "POST /api/evaluation/run-synthetic returns HTTP 200 OK");
    const bSummary = syntheticRes.body.benchmarkSummary;
    assert(bSummary !== undefined, "benchmarkSummary object present in response");
    assert(bSummary.incidentsProcessed === 50, `Successfully processed 50 synthetic incidents (actual: ${bSummary.incidentsProcessed})`);
    assert(bSummary.throughputOpsPerSecond > 200, `Throughput exceeds 200 ops/second (actual: ${bSummary.throughputOpsPerSecond} ops/sec)`);
    assert(parseFloat(bSummary.slaAdherenceRate) >= 95, `SLA Adherence Rate >= 95% (actual: ${bSummary.slaAdherenceRate})`);
    assert(bSummary.matchingDistribution.firstTierRatioPct >= 80, `First-tier optimal matching >= 80% (actual: ${bSummary.matchingDistribution.firstTierRatioPct}%)`);
    assert(bSummary.latencyDistribution.p95 <= 50, `Synthetic batch P95 latency <= 50ms (actual: ${bSummary.latencyDistribution.p95}ms)`);

    // -------------------------------------------------------------------------
    // TEST GROUP 5: Executive Summary & Documentation API Feed
    // -------------------------------------------------------------------------
    console.log("\n📋 TEST GROUP 5: Executive Summary & Documentation APIs");
    const summaryRes = await requestJson(`${API_BASE}/summary`);
    assert(summaryRes.status === 200, "GET /api/evaluation/summary returns HTTP 200 OK");
    assert(summaryRes.body.milestone.includes("Performance") || summaryRes.body.milestone.includes("Evaluation"), "Summary references Performance Evaluation");
    assert(summaryRes.body.keyMetrics.activeOperationalHospitals >= 5, `Reports at least 5 operational hospitals (actual: ${summaryRes.body.keyMetrics.activeOperationalHospitals})`);

    const docsFeedRes = await requestJson(`${API_BASE}/docs`);
    assert(docsFeedRes.status === 200, "GET /api/evaluation/docs returns HTTP 200 OK");
    assert(docsFeedRes.body.documents["final-report"] !== undefined, "Documentation feed returns Final Project Report");
    assert(docsFeedRes.body.documents["user-manual"] !== undefined, "Documentation feed returns User Documentation Manual");
    assert(docsFeedRes.body.documents["presentation"] !== undefined, "Documentation feed returns Presentation Materials");

  } catch (err) {
    console.error("\n💥 Critical Test Suite Error:", err);
    testsFailed++;
  }

  console.log("\n================================================================================");
  console.log(`TOTAL TESTS: ${testsRun} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
  console.log(`SYSTEM EVALUATION PASS RATE: ${((testsPassed / (testsRun || 1)) * 100).toFixed(1)}%`);
  console.log("================================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPerformanceTestSuite();
