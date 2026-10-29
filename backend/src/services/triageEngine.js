/**
 * MedLink Clinical Triage & Resource Conversion Engine
 * 
 * Implements logic for converting patient conditions into standardized resource
 * requirements (specialists, equipment, beds).
 */

const CATEGORY_KEYWORDS = {
  cardiac: [
    /cardiac/i, /heart/i, /chest pain/i, /infarction/i, /arrest/i,
    /angina/i, /arrhythmia/i, /palpitation/i, /stemi/i
  ],
  trauma: [
    /trauma/i, /accident/i, /crash/i, /fall/i, /fracture/i, /wound/i,
    /stab/i, /gunshot/i, /hemorrhage/i, /bleeding/i, /collision/i
  ],
  stroke: [
    /stroke/i, /cva/i, /facial droop/i, /slurred speech/i, /weakness/i,
    /hemiparesis/i, /paralysis/i, /aphasia/i
  ],
  respiratory: [
    /respiratory/i, /breath/i, /dyspnea/i, /choking/i, /asthma/i,
    /copd/i, /wheezing/i, /hypoxia/i, /stridor/i
  ],
  burns: [
    /burn/i, /scald/i, /chemical burn/i, /fire/i, /thermal/i
  ],
  pediatric: [
    /child/i, /infant/i, /baby/i, /pediatric/i, /toddler/i
  ],
  obstetric: [
    /pregnant/i, /labor/i, /delivery/i, /contractions/i, /maternity/i
  ],
  ent: [
    /ent/i, /ear/i, /nose/i, /throat/i, /epistaxis/i, /nasal bleed/i
  ],
  ophthalmic: [
    /eye/i, /vision/i, /ophthalm/i, /cornea/i, /globe/i, /ocular/i
  ],
  urology: [
    /urinary/i, /urine/i, /retention/i, /renal colic/i, /kidney stone/i, /testicular/i, /torsion/i
  ],
  psychiatric: [
    /psych/i, /agitation/i, /suicid/i, /hallucination/i, /panic/i, /delirium/i
  ]
};

/**
 * 1. Automatically detect clinical category if not specified
 */
function detectConditionCategory(complaint = "") {
  for (const [category, regexList] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regexList.some(r => r.test(complaint))) {
      return category;
    }
  }
  return "general";
}

/**
 * 2. Parse systolic BP (e.g. from "120/80" string or number)
 */
function extractSystolicBP(bloodPressure) {
  if (typeof bloodPressure === "number") return bloodPressure;
  if (typeof bloodPressure === "string") {
    const match = bloodPressure.match(/^(\d{2,3})/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/**
 * 3. Analyze patient vital signs for critical life threats
 */
function evaluateVitalSigns(vitals = {}) {
  const flags = [];
  let vitalSeverity = "low";
  let vitalTriage = "non-urgent";

  const hr = Number(vitals.heartRate);
  const rr = Number(vitals.respiratoryRate);
  const spo2 = Number(vitals.oxygenSaturation ?? vitals.spO2);
  const gcs = Number(vitals.gcs);
  const systolic = extractSystolicBP(vitals.bloodPressure || vitals.systolicBP);

  // Oxygen saturation checks
  if (Number.isFinite(spo2)) {
    if (spo2 < 85) {
      flags.push({ severity: "critical", msg: `Critical hypoxemia (SpO2: ${spo2}%) - immediate mechanical ventilation required.` });
      vitalSeverity = "critical";
      vitalTriage = "resuscitation";
    } else if (spo2 < 90) {
      flags.push({ severity: "high", msg: `Severe hypoxemia (SpO2: ${spo2}%) - high-flow oxygen and ICU bed required.` });
      vitalSeverity = "critical";
      vitalTriage = "resuscitation";
    } else if (spo2 < 94) {
      flags.push({ severity: "medium", msg: `Mild-to-moderate hypoxemia (SpO2: ${spo2}%).` });
      if (vitalSeverity !== "critical") vitalSeverity = "high";
      if (vitalTriage === "non-urgent" || vitalTriage === "semi-urgent") vitalTriage = "urgent";
    }
  }

  // Blood pressure (circulatory shock checks)
  if (Number.isFinite(systolic)) {
    if (systolic < 80) {
      flags.push({ severity: "critical", msg: `Severe circulatory shock (Systolic BP: ${systolic} mmHg).` });
      vitalSeverity = "critical";
      vitalTriage = "resuscitation";
    } else if (systolic < 90) {
      flags.push({ severity: "high", msg: `Impending circulatory shock (Systolic BP: ${systolic} mmHg).` });
      if (vitalSeverity !== "critical") vitalSeverity = "high";
      if (vitalTriage !== "resuscitation") vitalTriage = "emergency";
    } else if (systolic >= 170) {
      flags.push({ severity: "high", msg: `Hypertensive emergency risk (Systolic BP: ${systolic} mmHg).` });
      if (vitalSeverity !== "critical") vitalSeverity = "high";
      if (vitalTriage === "non-urgent" || vitalTriage === "semi-urgent") vitalTriage = "urgent";
    }
  }

  // Neurological GCS checks
  if (Number.isFinite(gcs)) {
    if (gcs <= 8) {
      flags.push({ severity: "critical", msg: `Severe coma (GCS: ${gcs}/15) - immediate airway intubation required.` });
      vitalSeverity = "critical";
      vitalTriage = "resuscitation";
    } else if (gcs <= 12) {
      flags.push({ severity: "high", msg: `Moderate neurological impairment (GCS: ${gcs}/15).` });
      if (vitalSeverity !== "critical") vitalSeverity = "high";
      if (vitalTriage !== "resuscitation") vitalTriage = "emergency";
    }
  }

  // Heart rate checks
  if (Number.isFinite(hr)) {
    if (hr > 140 || (hr > 0 && hr < 40)) {
      flags.push({ severity: "high", msg: `Unstable heart rate (${hr} bpm).` });
      if (vitalSeverity !== "critical") vitalSeverity = "high";
      if (vitalTriage !== "resuscitation") vitalTriage = "emergency";
    } else if (hr > 115) {
      if (vitalTriage === "non-urgent" || vitalTriage === "semi-urgent") vitalTriage = "urgent";
    }
  }

  // Respiratory rate checks
  if (Number.isFinite(rr) && (rr > 30 || (rr > 0 && rr < 8))) {
    flags.push({ severity: "high", msg: `Abnormal respiratory drive (${rr} breaths/min).` });
    if (vitalSeverity !== "critical") vitalSeverity = "high";
    if (vitalTriage !== "resuscitation") vitalTriage = "emergency";
  }

  return { vitalSeverity, vitalTriage, flags };
}

/**
 * 4. Main Conversion: Symptoms + Vitals -> Standardized Hospital Resources & Specialists
 */
function deriveStandardizedRequirements({
  chiefComplaint = "",
  conditionCategory = null,
  vitalSigns = {},
  patient = {}
}) {
  const category = conditionCategory
    ? conditionCategory.toLowerCase()
    : detectConditionCategory(chiefComplaint);

  const { vitalSeverity, vitalTriage, flags } = evaluateVitalSigns(vitalSigns);

  const resourceMap = new Map();
  const specialistMap = new Map();

  function addResource(resourceType, quantity = 1, priority = "mandatory", justification = "") {
    const existing = resourceMap.get(resourceType);
    if (!existing || (existing.priority !== "mandatory" && priority === "mandatory")) {
      resourceMap.set(resourceType, {
        requiredResourceType: resourceType,
        requiredQuantity: existing ? Math.max(existing.requiredQuantity, quantity) : quantity,
        priority,
        justification
      });
    }
  }

  function addSpecialist(specialty, count = 1, priority = "mandatory", justification = "") {
    const existing = specialistMap.get(specialty);
    if (!existing || (existing.priority !== "mandatory" && priority === "mandatory")) {
      specialistMap.set(specialty, {
        requiredSpecialty: specialty,
        specialistCount: existing ? Math.max(existing.specialistCount, count) : count,
        priority,
        justification
      });
    }
  }

  let baseSeverity = "medium";
  let baseTriage = "urgent";
  const rationales = [];

  switch (category) {
    case "cardiac":
      baseSeverity = "high";
      baseTriage = "emergency";
      rationales.push("Suspected acute cardiac pathology (STEMI, ACS, or life-threatening arrhythmia).");
      addSpecialist("Cardiology", 1, "mandatory", "Immediate cardiac intervention and reperfusion therapy.");
      addResource("ICU beds", 1, "mandatory", "Continuous hemodynamic monitoring.");
      addResource("defibrillators", 1, "mandatory", "Resuscitation preparedness.");
      break;

    case "trauma":
      if (/fracture|dislocation|closed/i.test(chiefComplaint) && !/collision|multi|shock|unresponsive|hemorrhage|stab|gunshot/i.test(chiefComplaint)) {
        baseSeverity = "medium";
        baseTriage = "urgent";
        rationales.push("Isolated skeletal trauma requiring orthopedic evaluation and radiography.");
        addSpecialist("Orthopedics", 1, "mandatory", "Fracture reduction and stabilization.");
        addResource("emergency beds", 1, "mandatory", "Emergency department observation and splinting.");
      } else {
        baseSeverity = "high";
        baseTriage = "emergency";
        rationales.push("Acute traumatic injury with potential hemorrhage or structural damage.");
        addSpecialist("Trauma Surgery", 1, "mandatory", "Surgical trauma management and hemorrhage control.");
        addSpecialist("Orthopedics", 1, "preferred", "Fracture stabilization and fixation.");
        addResource("Operating Room", 1, "mandatory", "Emergency surgical exploration.");
        addResource("CT scanners", 1, "mandatory", "Trauma whole-body pan-scan.");
        addResource("ICU beds", 1, "mandatory", "Post-trauma critical care resuscitation.");
      }
      break;

    case "stroke":
      baseSeverity = "high";
      baseTriage = "emergency";
      rationales.push("Acute stroke symptoms within golden hour window.");
      addSpecialist("Neurology", 1, "mandatory", "NIHSS evaluation and thrombolysis screening.");
      addResource("CT scanners", 1, "mandatory", "Immediate non-contrast head CT to rule out hemorrhage.");
      addResource("ICU beds", 1, "mandatory", "Neuro-intensive care monitoring.");
      break;

    case "respiratory":
      baseSeverity = "high";
      baseTriage = "emergency";
      rationales.push("Acute respiratory distress with ventilatory compromise.");
      addSpecialist("Pulmonology", 1, "mandatory", "Airway and pulmonary management.");
      addResource("ventilators", 1, "mandatory", "Mechanical ventilatory support.");
      addResource("ICU beds", 1, "mandatory", "Intensive respiratory care.");
      addResource("oxygen units", 1, "mandatory", "High-flow oxygen administration.");
      break;

    case "burns":
      baseSeverity = "high";
      baseTriage = "emergency";
      rationales.push("Severe burn injury requiring sterile care and fluid resuscitation.");
      addSpecialist("Plastic Surgery", 1, "mandatory", "Burn debridement and wound coverage.");
      addResource("Burn unit beds", 1, "mandatory", "Sterile isolation burn care.");
      break;

    case "pediatric":
      baseSeverity = "high";
      baseTriage = "urgent";
      rationales.push("Pediatric emergency requiring specialized pediatric monitoring.");
      addSpecialist("Pediatrics", 1, "mandatory", "Pediatric emergency assessment.");
      addResource("Pediatric ICU beds", 1, "mandatory", "Age-appropriate critical care.");
      break;

    case "obstetric":
      baseSeverity = "high";
      baseTriage = "emergency";
      rationales.push("Obstetric emergency with potential maternal-fetal compromise.");
      addSpecialist("Obstetrics & Gynecology", 1, "mandatory", "Emergency maternal delivery and assessment.");
      addResource("Labor & Delivery beds", 1, "mandatory", "Monitored delivery suite.");
      break;

    case "ent":
      baseSeverity = "high";
      baseTriage = "urgent";
      rationales.push("ENT / Upper airway acute clinical presentation.");
      addSpecialist("Ear, Nose and Throat", 1, "mandatory", "Airway and ENT emergency intervention.");
      addResource("emergency beds", 1, "mandatory", "ENT procedure unit.");
      break;

    case "ophthalmic":
      baseSeverity = "medium";
      baseTriage = "urgent";
      rationales.push("Ophthalmic emergency with potential visual impairment risk.");
      addSpecialist("Ophthalmology", 1, "mandatory", "Emergency ophthalmic examination and care.");
      addResource("emergency beds", 1, "mandatory", "Ophthalmic examination station.");
      break;

    case "urology":
      baseSeverity = "high";
      baseTriage = "urgent";
      rationales.push("Acute urological presentation requiring immediate decompression or surgical review.");
      addSpecialist("Urology", 1, "mandatory", "Emergency urological intervention.");
      addResource("emergency beds", 1, "mandatory", "Urological emergency bed.");
      break;

    case "psychiatric":
      baseSeverity = "medium";
      baseTriage = "urgent";
      rationales.push("Acute psychiatric crisis requiring de-escalation and safety monitoring.");
      addSpecialist("Psychiatry", 1, "mandatory", "Psychiatric crisis intervention.");
      addResource("emergency beds", 1, "mandatory", "Safe quiet room / emergency bed.");
      break;

    default:
      if (/rash|prescription|mild headache|itch|refill|chronic mild|follow-up/i.test(chiefComplaint)) {
        baseSeverity = "low";
        baseTriage = "non-urgent";
        rationales.push("Non-urgent primary care presentation with stable physiological parameters.");
        addSpecialist("Internal Medicine", 1, "preferred", "Outpatient review and medication management.");
        addResource("emergency beds", 1, "preferred", "Outpatient consultation station.");
      } else if (/sprain|laceration|strain|abrasion|minor contusion|swelling|suture/i.test(chiefComplaint)) {
        baseSeverity = "low";
        baseTriage = "semi-urgent";
        rationales.push("Semi-urgent acute presentation requiring wound care, simple splinting, or analgesia.");
        addSpecialist("General Surgery", 1, "preferred", "Wound closure or splinting.");
        addResource("emergency beds", 1, "mandatory", "Procedure / dressing station.");
      } else {
        baseSeverity = "medium";
        baseTriage = "urgent";
        rationales.push("General emergency presentation.");
        addSpecialist("Internal Medicine", 1, "preferred", "Acute internal medicine evaluation.");
        addResource("emergency beds", 1, "mandatory", "Standard emergency department bed.");
      }
      break;
  }

  // Vital sign escalation overrides
  const spo2 = Number(vitalSigns.oxygenSaturation ?? vitalSigns.spO2);
  if (Number.isFinite(spo2) && spo2 < 90) {
    addResource("ventilators", 1, "mandatory", "Mandatory mechanical ventilation due to SpO2 < 90%.");
    addResource("ICU beds", 1, "mandatory", "Critical care bed required for severe hypoxemia.");
  }

  const gcs = Number(vitalSigns.gcs);
  if (Number.isFinite(gcs) && gcs <= 8) {
    addResource("ventilators", 1, "mandatory", "Airway protection and intubation required (GCS <= 8).");
    addResource("ICU beds", 1, "mandatory", "Neuro-critical care bed required.");
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  const triageRank = { resuscitation: 5, emergency: 4, urgent: 3, "semi-urgent": 2, "non-urgent": 1 };

  const finalSeverity = severityRank[vitalSeverity] > severityRank[baseSeverity] ? vitalSeverity : baseSeverity;
  const finalTriage = triageRank[vitalTriage] > triageRank[baseTriage] ? vitalTriage : baseTriage;

  flags.forEach(f => rationales.push(f.msg));

  return {
    conditionCategory: category,
    severity: finalSeverity,
    triageLevel: finalTriage,
    requiredResources: Array.from(resourceMap.values()),
    requiredSpecialists: Array.from(specialistMap.values()),
    vitalAlerts: flags,
    clinicalRationale: rationales.join(" ")
  };
}

module.exports = {
  detectConditionCategory,
  evaluateVitalSigns,
  deriveStandardizedRequirements
};
