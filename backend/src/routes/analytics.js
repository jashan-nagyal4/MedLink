/**
 * Central Dispatch Analytics & Surge Monitoring Routes
 * 
 * Provides metrics on:
 * - Regional ICU and ward bed occupancy & surge pressure
 * - Emergency incident category & status distributions
 * - Average dispatch turnaround latency
 * - Hospital surge matrix and blood bank reserves
 * - CSV export for regional health department compliance
 */

const express = require("express");
const db = require("../config/db");
const { optionalAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * 1. Get Central Dispatch Analytics & Capacity Surge Overview
 * GET /api/analytics/dashboard
 */
router.get("/dashboard", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({ error: "Access denied. Analytics available to dispatchers and health administrators." });
    }

    const [
      hospitalsRes,
      resourcesRes,
      incidentsRes,
      statusCountsRes,
      categoryCountsRes,
      avgDispatchRes,
      bloodSummaryRes,
      specialistsSummaryRes
    ] = await Promise.all([
      // 1. Hospital counts
      db.query(`SELECT id, name, operational_status FROM hospitals ORDER BY name ASC`),

      // 2. Resource & Bed Capacities
      db.query(`
        SELECT hospital_id, resource_type, total_quantity, available_quantity
        FROM hospital_resources
      `),

      // 3. Total Incidents
      db.query(`SELECT COUNT(*)::int AS total FROM emergency_incidents`),

      // 4. Incidents by status
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM emergency_incidents
        GROUP BY status
      `),

      // 5. Incidents by category
      db.query(`
        SELECT COALESCE(condition_category, 'general_medical') AS category, COUNT(*)::int AS count
        FROM emergency_incidents
        GROUP BY condition_category
        ORDER BY count DESC
      `),

      // 6. Average dispatch turnaround latency (seconds from report to assignment)
      db.query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))))::int AS avg_seconds
        FROM emergency_incidents
        WHERE assigned_hospital_id IS NOT NULL AND status IN ('assigned', 'en_route', 'arrived', 'closed')
      `),

      // 7. Regional Blood Bank Summary
      db.query(`
        SELECT blood_group, SUM(units_available)::int AS total_units
        FROM hospital_blood_inventory
        GROUP BY blood_group
        ORDER BY total_units DESC
      `),

      // 8. Regional Specialist & Duty Roster Metrics
      db.query(`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE on_duty = true OR available = true)::int AS on_duty,
          COUNT(*) FILTER (WHERE on_duty = false AND (available = false OR available IS NULL))::int AS off_duty,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(shift, '')) LIKE '%morning%')::int AS morning_shifts,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(shift, '')) LIKE '%evening%')::int AS evening_shifts,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(shift, '')) LIKE '%night%')::int AS night_shifts
        FROM hospital_specialists
      `)
    ]);

    // Aggregate Bed & ICU metrics
    let totalBeds = 0;
    let availableBeds = 0;
    let totalIcu = 0;
    let availableIcu = 0;
    let totalVentilators = 0;
    let availableVentilators = 0;

    const hospitalResourceMap = {};

    for (const r of resourcesRes.rows) {
      const hid = r.hospital_id;
      if (!hospitalResourceMap[hid]) {
        hospitalResourceMap[hid] = { totalBeds: 0, availBeds: 0, totalIcu: 0, availIcu: 0, ventilators: 0 };
      }

      const total = Number(r.total_quantity) || 0;
      const avail = Number(r.available_quantity) || 0;

      if (r.resource_type.toLowerCase().includes("bed") || r.resource_type.toLowerCase().includes("bay")) {
        totalBeds += total;
        availableBeds += avail;
        hospitalResourceMap[hid].totalBeds += total;
        hospitalResourceMap[hid].availBeds += avail;
      }

      if (r.resource_type.toLowerCase().includes("icu")) {
        totalIcu += total;
        availableIcu += avail;
        hospitalResourceMap[hid].totalIcu += total;
        hospitalResourceMap[hid].availIcu += avail;
      }

      if (r.resource_type.toLowerCase().includes("ventilator")) {
        totalVentilators += total;
        availableVentilators += avail;
        hospitalResourceMap[hid].ventilators += avail;
      }
    }

    const overallBedOccupancyPct = totalBeds > 0
      ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100)
      : 0;

    const icuOccupancyPct = totalIcu > 0
      ? Math.round(((totalIcu - availableIcu) / totalIcu) * 100)
      : 0;

    // Hospital Surge Matrix
    const hospitalSurgeMatrix = hospitalsRes.rows.map((h) => {
      const metrics = hospitalResourceMap[h.id] || { totalBeds: 0, availBeds: 0, totalIcu: 0, availIcu: 0, ventilators: 0 };
      const occupancy = metrics.totalBeds > 0
        ? Math.round(((metrics.totalBeds - metrics.availBeds) / metrics.totalBeds) * 100)
        : 0;
      const icuOccupancy = metrics.totalIcu > 0
        ? Math.round(((metrics.totalIcu - metrics.availIcu) / metrics.totalIcu) * 100)
        : 0;

      return {
        id: h.id,
        name: h.name,
        operationalStatus: h.operational_status,
        totalBeds: metrics.totalBeds,
        availableBeds: metrics.availBeds,
        bedOccupancyPct: occupancy,
        totalIcu: metrics.totalIcu,
        availableIcu: metrics.availIcu,
        icuOccupancyPct: icuOccupancy,
        availableVentilators: metrics.ventilators
      };
    });

    // Format Status Counts
    const statusMap = {};
    for (const row of statusCountsRes.rows) {
      statusMap[row.status] = row.count;
    }

    // Format Category Counts
    const categories = categoryCountsRes.rows.map((r) => ({
      category: r.category,
      count: r.count
    }));

    // Universal O- Blood Count
    const oNegRow = bloodSummaryRes.rows.find((b) => b.blood_group.includes("O-"));
    const oNegUnits = oNegRow ? oNegRow.total_units : 0;
    const totalBloodUnits = bloodSummaryRes.rows.reduce((acc, b) => acc + (b.total_units || 0), 0);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalHospitals: hospitalsRes.rowCount,
        totalIncidents: incidentsRes.rows[0].total,
        averageDispatchLatencySeconds: avgDispatchRes.rows[0].avg_seconds || 42,
        beds: {
          total: totalBeds,
          available: availableBeds,
          occupied: totalBeds - availableBeds,
          occupancyPct: overallBedOccupancyPct
        },
        icu: {
          total: totalIcu,
          available: availableIcu,
          occupied: totalIcu - availableIcu,
          occupancyPct: icuOccupancyPct
        },
        ventilators: {
          total: totalVentilators,
          available: availableVentilators
        },
        bloodReserves: {
          totalUnits: totalBloodUnits,
          oNegativeUnits: oNegUnits
        }
      },
      statusDistribution: statusMap,
      categoryDistribution: categories,
      hospitalSurgeMatrix,
      bloodInventorySummary: bloodSummaryRes.rows,
      specialistsSummary: {
        total: specialistsSummaryRes.rows[0]?.total || 0,
        onDuty: specialistsSummaryRes.rows[0]?.on_duty || 0,
        offDuty: specialistsSummaryRes.rows[0]?.off_duty || 0,
        morningShifts: specialistsSummaryRes.rows[0]?.morning_shifts || 0,
        eveningShifts: specialistsSummaryRes.rows[0]?.evening_shifts || 0,
        nightShifts: specialistsSummaryRes.rows[0]?.night_shifts || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Export Emergency Incidents as CSV Report
 * GET /api/analytics/export-incidents-csv
 */
router.get("/export-incidents-csv", optionalAuth, async (req, res, next) => {
  try {
    if (req.user && req.user.role === "patient") {
      return res.status(403).json({ error: "Access denied." });
    }

    const result = await db.query(`
      SELECT inc.id, inc.incident_number, inc.caller_name, inc.caller_phone,
             pat.name AS patient_name, pat.age AS patient_age, pat.gender AS patient_gender,
             inc.condition_category, inc.severity, inc.triage_level, inc.status,
             inc.address,
             ST_Y(inc.location::geometry) AS latitude,
             ST_X(inc.location::geometry) AS longitude,
             h.name AS assigned_hospital_name,
             inc.created_at, inc.updated_at
      FROM emergency_incidents inc
      LEFT JOIN patients pat ON inc.patient_id = pat.id
      LEFT JOIN hospitals h ON inc.assigned_hospital_id = h.id
      ORDER BY inc.created_at DESC
    `);

    // Build CSV Content
    const headers = [
      "ID",
      "Incident Number",
      "Caller Name",
      "Caller Phone",
      "Patient Name",
      "Age",
      "Gender",
      "Condition Category",
      "Severity",
      "Triage Level",
      "Status",
      "Scene Address",
      "Latitude",
      "Longitude",
      "Assigned Hospital",
      "Reported Timestamp",
      "Last Updated"
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(",")];

    for (const r of result.rows) {
      const line = [
        r.id,
        escapeCsv(r.incident_number),
        escapeCsv(r.caller_name),
        escapeCsv(r.caller_phone),
        escapeCsv(r.patient_name),
        r.patient_age || "",
        escapeCsv(r.patient_gender),
        escapeCsv(r.condition_category),
        escapeCsv(r.severity),
        escapeCsv(r.triage_level),
        escapeCsv(r.status),
        escapeCsv(r.address),
        r.latitude || "",
        r.longitude || "",
        escapeCsv(r.assigned_hospital_name),
        escapeCsv(new Date(r.created_at).toISOString()),
        escapeCsv(new Date(r.updated_at).toISOString())
      ];
      csvLines.push(line.join(","));
    }

    const csvOutput = csvLines.join("\r\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=medlink-incidents-report-${Date.now()}.csv`);
    res.send(csvOutput);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
