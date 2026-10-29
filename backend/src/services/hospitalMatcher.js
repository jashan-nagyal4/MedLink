/**
 * MedLink Geo-spatial Matching & Multi-Criteria Hospital Ranking Engine
 * 
 * 1. PostGIS queries for finding hospitals within a specified radius.
 * 2. Multi-criteria scoring algorithm (Travel time, Resource availability, Specialist verification, Data freshness).
 * 3. Travel time estimation model.
 * 4. Refined ranking logic with eligibility determination.
 */

const db = require("../config/db");

// Scoring weights (sum to 1.0)
const WEIGHTS = {
  travelTime: 0.35,      // 35%
  resourceMatch: 0.30,   // 30%
  specialistMatch: 0.25, // 25%
  dataFreshness: 0.10    // 10%
};

// Emergency vehicle urban transit speed (~35 km/h = 583 meters per minute)
const METERS_PER_MINUTE = 583.33;
const BASE_DISPATCH_MINUTES = 2.0;

/**
 * Estimate travel time in minutes based on distance in meters.
 */
function estimateTravelTimeMinutes(distanceMeters) {
  const transitTime = distanceMeters / METERS_PER_MINUTE;
  return Number((BASE_DISPATCH_MINUTES + transitTime).toFixed(1));
}

/**
 * Score proximity (0 to 100 points).
 * Closer distance gets higher score.
 */
function calculateProximityScore(distanceMeters, radiusMeters) {
  if (distanceMeters <= 500) return 100;
  const ratio = Math.min(distanceMeters / radiusMeters, 1.0);
  return Math.max(0, Math.round(100 - (ratio * 75)));
}

/**
 * Score data freshness based on latest update timestamp (0 to 100 points).
 */
function calculateFreshnessScore(lastUpdatedAt) {
  if (!lastUpdatedAt) return 50;
  const elapsedHours = (Date.now() - new Date(lastUpdatedAt).getTime()) / (1000 * 60 * 60);

  if (elapsedHours <= 1) return 100;
  if (elapsedHours <= 3) return 85;
  if (elapsedHours <= 6) return 70;
  if (elapsedHours <= 12) return 50;
  return 30;
}

/**
 * Normalizes resource names into standardized clinical triage equipment categories.
 * Maps hospital-specific names (e.g. 'Mechanical Ventilator', 'Defibrillator Unit', 'ICU Bed')
 * to standard clinical requirements ('ventilators', 'defibrillators', 'ICU beds').
 */
function normalizeResourceCategory(name = "") {
  const clean = (name || "").toLowerCase().trim();
  if (clean.includes("defibrillator") || clean.includes("aed")) return "defibrillators";
  if (clean.includes("ventilator")) return "ventilators";
  if (clean.includes("icu") && (clean.includes("pediatric") || clean.includes("paediatric") || clean.includes("nicu") || clean.includes("picu"))) return "pediatric_icu_beds";
  if (clean.includes("icu") || clean.includes("critical care")) return "icu_beds";
  if (clean.includes("operating room") || clean.includes("operation theatre") || clean === "or" || clean.includes("trauma or") || clean.includes("operating")) return "operating_room";
  if (clean.includes("ct scan") || clean.includes("ct-scan") || clean.includes("ct scanner")) return "ct_scanners";
  if (clean.includes("mri")) return "mri_scanners";
  if (clean.includes("telemetry") || clean.includes("cardiac monitor")) return "telemetry_monitors";
  if (clean.includes("dialysis")) return "dialysis_machines";
  if (clean.includes("isolation") || clean.includes("negative pressure")) return "isolation_rooms";
  if (clean.includes("oxygen")) return "oxygen_units";
  if (clean.includes("burn")) return "burn_unit_beds";
  if (clean.includes("delivery") || clean.includes("labor") || clean.includes("maternity")) return "labor_delivery_beds";
  if (clean.includes("bay") || clean.includes("resuscitation")) return "resuscitation_bays";
  if (clean.includes("bed") || clean.includes("ward")) return "emergency_beds";
  return clean;
}

/**
 * Checks if a hospital resource satisfies a required triage resource
 */
function doesResourceMatch(hospResourceType = "", requiredResourceType = "") {
  const hLower = (hospResourceType || "").toLowerCase().trim();
  const rLower = (requiredResourceType || "").toLowerCase().trim();

  // Exact or direct match
  if (hLower === rLower) return true;

  // Normalization comparison (e.g. 'Mechanical Ventilator' <=> 'ventilators', 'Defibrillator Unit' <=> 'defibrillators')
  const hospNorm = normalizeResourceCategory(hospResourceType);
  const reqNorm = normalizeResourceCategory(requiredResourceType);
  if (hospNorm === reqNorm) return true;

  // Singular/plural and substring fallback
  if (hLower.includes(rLower) || rLower.includes(hLower)) return true;
  if (hLower.replace(/s$/, "") === rLower.replace(/s$/, "")) return true;

  return false;
}

/**
 * Normalizes specialist specialties into standardized clinical categories
 */
function normalizeSpecialty(name = "") {
  const clean = (name || "").toLowerCase().trim();
  if (clean.includes("cardio") || clean.includes("ctvs") || clean.includes("cardiothoracic")) return "cardiology";
  if (clean.includes("trauma")) return "trauma_surgery";
  if (clean.includes("neurosur")) return "neurosurgery";
  if (clean.includes("neuro")) return "neurology";
  if (clean.includes("pulmon") || clean.includes("respirat")) return "pulmonology";
  if (clean.includes("ortho") || clean.includes("spine")) return "orthopedics";
  if (clean.includes("pediatric") || clean.includes("paediatric") || clean.includes("neonat")) return "pediatrics";
  if (clean.includes("obstetric") || clean.includes("gynec") || clean.includes("matern")) return "obstetrics";
  if (clean.includes("internal") || clean.includes("general medicine") || clean.includes("medical officer") || clean.includes("medical services")) return "internal_medicine";
  if (clean.includes("ear") || clean.includes("ent") || clean.includes("throat") || clean.includes("nose") || clean.includes("speech and hearing")) return "ent";
  if (clean.includes("ophthalm") || clean.includes("eye")) return "ophthalmology";
  if (clean.includes("urol")) return "urology";
  if (clean.includes("psychiat")) return "psychiatry";
  if (clean.includes("radiodiagnosis") || clean.includes("radiolog")) return "radiology";
  if (clean.includes("transfusion") || clean.includes("blood")) return "transfusion_medicine";
  if (clean.includes("dermat")) return "dermatology";
  if (clean.includes("patholog")) return "pathology";
  if (clean.includes("microbiol")) return "microbiology";
  if (clean.includes("biochem")) return "biochemistry";
  if (clean.includes("burn") || clean.includes("plastic")) return "plastic_surgery";
  if (clean.includes("gastro") || clean.includes("hepatolog")) return "gastroenterology";
  if (clean.includes("dental") || clean.includes("dentist") || clean.includes("oral") || clean.includes("maxillofacial")) return "dental_surgery";
  if (clean.includes("dialysis") || clean.includes("nephro") || clean.includes("kidney")) return "nephrology";
  if (clean.includes("oncol")) return "oncology";
  if (clean.includes("vascul")) return "vascular_surgery";
  if (clean.includes("physiotherap") || clean.includes("diet")) return "physiotherapy";
  if (clean.includes("forensic")) return "forensic_medicine";
  if (clean.includes("community") || clean.includes("epidemiol") || clean.includes("statistics")) return "community_medicine";
  if (clean.includes("anatom")) return "anatomy";
  if (clean.includes("physiol")) return "physiology";
  if (clean.includes("pharmac")) return "pharmacology";
  if (clean.includes("intensiv") || clean.includes("critical care")) return "critical_care";
  if (clean.includes("emerg")) return "emergency_medicine";
  if (clean.includes("anesthe") || clean.includes("anaesthe")) return "anesthesiology";
  if (clean.includes("surg")) return "general_surgery";
  return clean;
}

/**
 * Checks if a hospital specialist satisfies a required triage specialist
 */
function doesSpecialtyMatch(hospSpec = "", reqSpec = "") {
  const hLower = (hospSpec || "").toLowerCase().trim();
  const rLower = (reqSpec || "").toLowerCase().trim();
  if (hLower === rLower) return true;
  if (normalizeSpecialty(hospSpec) === normalizeSpecialty(reqSpec)) return true;
  if (hLower.includes(rLower) || rLower.includes(hLower)) return true;
  return false;
}

/**
 * Primary matching function: Ranks candidate hospitals for an emergency incident.
 */
async function rankHospitalsForIncident(incidentId, customRadiusMeters = 30000) {
  // 1. Fetch Incident Location & Requirements
  const incRes = await db.query(
    `SELECT id, incident_number, address, severity, triage_level,
            chief_complaint, condition_category,
            ST_Y(location::geometry) AS latitude,
            ST_X(location::geometry) AS longitude
     FROM emergency_incidents WHERE id = $1`,
    [incidentId]
  );

  if (!incRes.rowCount) {
    throw new Error(`Incident #${incidentId} not found.`);
  }

  const incident = incRes.rows[0];

  // Fetch incident required resources & specialists
  const reqRes = await db.query(
    `SELECT * FROM incident_resource_requirements WHERE incident_id = $1`,
    [incidentId]
  );
  const requirements = reqRes.rows;

  // Split into required equipment/beds and required specialists
  const requiredBedsAndEquipment = requirements.filter(r => r.required_resource_type);
  const requiredDoctors = requirements.filter(r => r.required_specialty);

  // 2. Query Candidate Hospitals within Radius using PostGIS
  const candidateHospitalsQuery = `
    SELECT h.id, h.name, h.address, h.phone, h.email, h.operational_status,
           h.updated_at,
           ST_Y(h.location::geometry) AS latitude,
           ST_X(h.location::geometry) AS longitude,
           ROUND(ST_Distance(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric) AS distance_meters
    FROM hospitals h
    WHERE h.operational_status <> 'closed'
      AND ST_DWithin(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ORDER BY distance_meters ASC
  `;

  const candidatesRes = await db.query(candidateHospitalsQuery, [
    incident.longitude,
    incident.latitude,
    customRadiusMeters
  ]);

  if (!candidatesRes.rowCount) {
    return {
      incident,
      radiusMeters: customRadiusMeters,
      rankedHospitals: [],
      message: `No operational hospitals found within ${(customRadiusMeters / 1000).toFixed(0)} km.`
    };
  }

  const candidateHospitals = candidatesRes.rows;

  // 3. Score Each Hospital using MCDM
  const rankedHospitals = [];

  for (const hosp of candidateHospitals) {
    // Fetch this hospital's live resources and specialists
    const [hospResourcesRes, hospSpecialistsRes] = await Promise.all([
      db.query("SELECT * FROM hospital_resources WHERE hospital_id = $1", [hosp.id]),
      db.query("SELECT * FROM hospital_specialists WHERE hospital_id = $1", [hosp.id])
    ]);

    const availableResources = hospResourcesRes.rows;
    const availableSpecialists = hospSpecialistsRes.rows;

    const distanceMeters = Number(hosp.distance_meters);
    const estimatedMinutes = estimateTravelTimeMinutes(distanceMeters);
    const travelScore = calculateProximityScore(distanceMeters, customRadiusMeters);

    // --- Resource Scoring ---
    let resourceScore = 100;
    const resourceBreakdown = [];
    let hasMandatoryResourceDeficit = false;

    for (const req of requiredBedsAndEquipment) {
      // Find all matching resources (e.g., 'Mechanical Ventilator' <=> 'ventilators', 'Defibrillator Unit' <=> 'defibrillators')
      const matching = availableResources.filter(r =>
        doesResourceMatch(r.resource_type, req.required_resource_type)
      );

      const availableQty = matching.reduce((sum, r) => sum + (Number(r.available_quantity) || 0), 0);
      const isSufficient = availableQty >= req.required_quantity;

      resourceBreakdown.push({
        resourceType: req.required_resource_type,
        matchedFacilityResource: matching.length > 0 ? matching.map(m => m.resource_type).join(", ") : "None",
        requiredQty: req.required_quantity,
        availableQty,
        priority: req.priority,
        satisfied: isSufficient
      });

      if (!isSufficient) {
        if (req.priority === "mandatory") {
          hasMandatoryResourceDeficit = true;
          resourceScore -= 50;
        } else {
          resourceScore -= 20;
        }
      }
    }
    resourceScore = Math.max(0, resourceScore);

    // --- Specialist Scoring ---
    let specialistScore = 100;
    const specialistBreakdown = [];
    let hasMandatorySpecialistDeficit = false;

    for (const req of requiredDoctors) {
      // Find matching specialists (e.g. 'Trauma Surgeon' <=> 'Trauma Surgery', 'Cardiologist' <=> 'Cardiology')
      const matching = availableSpecialists.filter(s =>
        doesSpecialtyMatch(s.specialty, req.required_specialty)
      );

      const availableCount = matching.reduce((sum, s) => {
        const isAvail = s.on_duty !== undefined ? s.on_duty : s.available;
        const count = s.count_available !== undefined ? Number(s.count_available) : (s.available_count !== undefined ? Number(s.available_count) : 1);
        return isAvail ? sum + Math.max(1, count) : sum;
      }, 0);

      const isOnDuty = availableCount >= req.specialist_count;

      specialistBreakdown.push({
        specialty: req.required_specialty,
        matchedSpecialty: matching.length > 0 ? matching.map(m => m.specialty).join(", ") : "None",
        requiredCount: req.specialist_count,
        availableCount,
        onDuty: isOnDuty,
        priority: req.priority,
        satisfied: isOnDuty
      });

      if (!isOnDuty) {
        if (req.priority === "mandatory") {
          hasMandatorySpecialistDeficit = true;
          specialistScore -= 50;
        } else {
          resourceScore -= 20;
        }
      }
    }
    specialistScore = Math.max(0, specialistScore);

    // --- Freshness Scoring ---
    const latestResourceUpdate = availableResources.reduce((latest, r) => {
      const d = new Date(r.updated_at).getTime();
      return d > latest ? d : latest;
    }, new Date(hosp.updated_at).getTime());

    const freshnessScore = calculateFreshnessScore(latestResourceUpdate);

    // --- Composite Weighted Score ---
    const compositeScore = Number((
      (travelScore * WEIGHTS.travelTime) +
      (resourceScore * WEIGHTS.resourceMatch) +
      (specialistMatchScore(specialistScore) * WEIGHTS.specialistMatch) +
      (freshnessScore * WEIGHTS.dataFreshness)
    ).toFixed(1));

    // Determine eligibility
    const isEligible = !hasMandatoryResourceDeficit && !hasMandatorySpecialistDeficit;

    // Build human-readable clinical rationale
    let recommendationReason = "";
    if (isEligible) {
      recommendationReason = `Fully equipped: ${(distanceMeters / 1000).toFixed(1)} km away (~${estimatedMinutes} mins transit). All mandatory beds and specialists verified.`;
    } else {
      const deficits = [];
      if (hasMandatoryResourceDeficit) deficits.push("insufficient required beds/equipment");
      if (hasMandatorySpecialistDeficit) deficits.push("required specialist not on duty");
      recommendationReason = `Caution: ${(distanceMeters / 1000).toFixed(1)} km away, but has ${deficits.join(" and ")}.`;
    }

    rankedHospitals.push({
      hospitalId: hosp.id,
      name: hosp.name,
      address: hosp.address,
      phone: hosp.phone,
      operationalStatus: hosp.operational_status,
      coordinates: { latitude: hosp.latitude, longitude: hosp.longitude },
      distanceMeters,
      distanceKm: Number((distanceMeters / 1000).toFixed(1)),
      estimatedTravelMinutes: estimatedMinutes,
      compositeScore,
      isEligible,
      scoringBreakdown: {
        travelScore,
        resourceScore,
        specialistScore,
        freshnessScore
      },
      matchedResources: resourceBreakdown,
      matchedSpecialists: specialistBreakdown,
      recommendationReason
    });
  }

  function specialistMatchScore(score) {
    return score;
  }

  // 4. Sort Candidates:
  // First prioritize eligible hospitals (have required beds + doctors), then by compositeScore descending
  rankedHospitals.sort((a, b) => {
    if (a.isEligible && !b.isEligible) return -1;
    if (!a.isEligible && b.isEligible) return 1;
    return b.compositeScore - a.compositeScore;
  });

  // Assign 1-based ranks
  rankedHospitals.forEach((h, idx) => {
    h.rank = idx + 1;
  });

  return {
    incident,
    requiredBedsAndEquipment,
    requiredDoctors,
    radiusKm: Number((customRadiusMeters / 1000).toFixed(0)),
    rankedHospitals
  };
}

module.exports = {
  rankHospitalsForIncident,
  estimateTravelTimeMinutes,
  calculateProximityScore,
  calculateFreshnessScore,
  normalizeResourceCategory,
  doesResourceMatch,
  normalizeSpecialty,
  doesSpecialtyMatch,
  WEIGHTS
};
