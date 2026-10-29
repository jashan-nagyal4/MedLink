/**
 * MedLink Autonomous Incident Simulator Engine
 * 
 * Periodically generates realistic, high-fidelity emergency incidents
 * across Jammu landmarks (Jewel Chowk, Gandhi Nagar, Bahu Plaza, Janipur, etc.).
 * 
 * Features:
 * - Dynamic generation of patient records & standardized triage requirements.
 * - Broadcasts real-time events via Socket.IO for instant live queue popups.
 * - Triggers MCDM hospital matching and automated dispatch requests.
 * - Simulates realistic post-dispatch lifecycles (requested -> accepted -> en_route -> arrived).
 * - Full settings control: toggleable status, speed/interval presets, target hospital filter, auto-progression toggle.
 */

const db = require('../config/db');
const { deriveStandardizedRequirements } = require('./triageEngine');
const socketService = require('./socketService');
const coordinationEngine = require('./coordinationEngine');

const JAMMU_INCIDENT_SCENARIOS = [
  {
    address: 'Jewel Chowk Traffic Intersection, Jammu',
    lat: 32.7235,
    lng: 74.8562,
    callerName: 'Sunil Sharma (Traffic Warden)',
    callerPhone: '+91-9419111222',
    chiefComplaint: 'Pedestrian struck by passenger bus, lower limb compound fracture with profuse arterial bleeding and altered sensorium',
    conditionCategory: 'trauma',
    vitalSigns: { heartRate: 124, systolicBP: 88, oxygenSaturation: 91, respiratoryRate: 26 },
    patient: { name: 'Kuldeep Kumar', age: 42, gender: 'male', medicalHistory: 'None', allergies: 'Penicillin' },
    notes: 'Severe hypovolemic shock signs. Direct compression applied on scene.',
    preferredHospitalId: 4 // GMC Jammu
  },
  {
    address: 'Bahu Plaza Commercial Complex, Rail Head, Jammu',
    lat: 32.7058,
    lng: 74.8785,
    callerName: 'Priya Jamwal (Security Desk)',
    callerPhone: '+91-9419133444',
    chiefComplaint: 'Sudden collapse in corporate lobby, crushing central chest pain radiating to left jaw, clammy skin and dyspnea',
    conditionCategory: 'cardiac',
    vitalSigns: { heartRate: 110, systolicBP: 145, oxygenSaturation: 94, respiratoryRate: 22 },
    patient: { name: 'Vikas Choudhary', age: 48, gender: 'male', medicalHistory: 'Type 2 Diabetes, Hypertension', allergies: 'None' },
    notes: 'Probable acute STEMI coronary event. Defibrillator and cath lab readiness requested.',
    preferredHospitalId: 4 // GMC Jammu
  },
  {
    address: 'Janipur Main Stop, Bantalab Road, Jammu',
    lat: 32.7560,
    lng: 74.8385,
    callerName: 'Amit Verma (Son)',
    callerPhone: '+91-9419155666',
    chiefComplaint: 'Acute onset right-sided hemiplegia, severe facial droop and expressive aphasia within last 25 minutes',
    conditionCategory: 'stroke',
    vitalSigns: { heartRate: 88, systolicBP: 185, oxygenSaturation: 97, respiratoryRate: 18 },
    patient: { name: 'Kamla Devi', age: 67, gender: 'female', medicalHistory: 'Atrial Fibrillation', allergies: 'Sulfa drugs' },
    notes: 'Well within 4.5-hour thrombolysis window. Emergency CT Brain priority.',
    preferredHospitalId: 14 // Super Speciality Hospital, GMC Jammu
  },
  {
    address: 'NH-44 Bypass Junction, near Channi Himmat, Jammu',
    lat: 32.6845,
    lng: 74.8852,
    callerName: 'Highway Patrol PCR Jammu',
    callerPhone: '+91-191-2460111',
    chiefComplaint: 'Two-vehicle rollover crash, driver trapped behind steering column with blunt thoracic trauma and flail chest',
    conditionCategory: 'trauma',
    vitalSigns: { heartRate: 132, systolicBP: 92, oxygenSaturation: 89, respiratoryRate: 30 },
    patient: { name: 'Gurpreet Singh', age: 31, gender: 'male', medicalHistory: 'None', allergies: 'None' },
    notes: 'Extrication completed by fire services. High-flow oxygen initiated en route.',
    preferredHospitalId: 5 // ASCOMS & Batra Hospital
  },
  {
    address: 'Talab Tillo Main Road near Canal, Jammu',
    lat: 32.7180,
    lng: 74.8310,
    callerName: 'Dr. Neha (Pediatric Clinic)',
    callerPhone: '+91-9419199000',
    chiefComplaint: 'Pediatric severe stridor, barking cough, and respiratory exhaustion in a 4-year-old child',
    conditionCategory: 'pediatric',
    vitalSigns: { heartRate: 140, systolicBP: 95, oxygenSaturation: 90, respiratoryRate: 42 },
    patient: { name: 'Aarav Sharma', age: 4, gender: 'male', medicalHistory: 'Bronchial Asthma', allergies: 'None' },
    notes: 'Severe chest indrawing observed. Urgent pediatric ICU / nebulization bay required.',
    preferredHospitalId: 13 // SMGS Hospital
  },
  {
    address: 'Sarwal Chowk, Amphalla Road, Jammu',
    lat: 32.7485,
    lng: 74.8492,
    callerName: 'Rajinder Saini (Bystander)',
    callerPhone: '+91-9419122333',
    chiefComplaint: 'Motorcycle slip on wet gravel, deep bleeding lacerations on thigh with open knee joint dislocation',
    conditionCategory: 'trauma',
    vitalSigns: { heartRate: 102, systolicBP: 118, oxygenSaturation: 98, respiratoryRate: 18 },
    patient: { name: 'Rohit Saini', age: 24, gender: 'male', medicalHistory: 'None', allergies: 'None' },
    notes: 'Splinting applied. Wound dressing intact.',
    preferredHospitalId: 4 // GMC Jammu
  },
  {
    address: 'Shalamar Road near Heritage Hospital, Jammu',
    lat: 32.7302,
    lng: 74.8681,
    callerName: 'Pooja Jamwal (Mother)',
    callerPhone: '+91-9419188999',
    chiefComplaint: 'High febrile convulsions in 18-month-old infant, ongoing twitching for over 4 minutes with frothing',
    conditionCategory: 'pediatric',
    vitalSigns: { heartRate: 155, systolicBP: 90, oxygenSaturation: 93, respiratoryRate: 38 },
    patient: { name: 'Baby Vihaan', age: 1, gender: 'male', medicalHistory: 'Febrile episode yesterday', allergies: 'None' },
    notes: 'Midazolam buccal spray administered. En route to emergency facility.',
    preferredHospitalId: 13 // SMGS Hospital
  },
  {
    address: 'Sidhra Byepass Road near Golf Course, Jammu',
    lat: 32.7533,
    lng: 74.9122,
    callerName: 'Vikram Jamwal (Commuter)',
    callerPhone: '+91-9419177111',
    chiefComplaint: 'Four-wheel collision, passenger sustained clavicle fracture and scalp contusion with transient blackout',
    conditionCategory: 'trauma',
    vitalSigns: { heartRate: 96, systolicBP: 125, oxygenSaturation: 97, respiratoryRate: 18 },
    patient: { name: 'Ajay Jamwal', age: 34, gender: 'male', medicalHistory: 'None', allergies: 'None' },
    notes: 'C-spine immobilized. Trauma reception pre-advised.',
    preferredHospitalId: 2 // Ankur Maitrika Hospital
  }
];

let timerInterval = null;
let resourceTimerInterval = null;
let bloodTimerInterval = null;
let isRunning = false;
let totalSimulated = 0;
let lastSpawnedAt = null;
let lastSpawnedIncident = null;
let scenarioIndex = 0;
let currentIntervalMs = 45000; // default 45 seconds for emergency CAD calls
let resourceIntervalMs = 20000; // default 20 seconds for auto bed fluctuations
let bloodIntervalMs = 5000; // default 5 seconds rapid jumping cadence for blood banks
let autoProgress = true; // whether to automatically progress from requested -> en_route -> arrived
let autoBeds = true; // whether to automatically simulate patient admissions (use) and discharges (empty/free)
let autoBlood = true; // whether to automatically simulate transfusions (use) and donor restocking (fill)
let pinnedHospitalId = null; // if set, force simulation to target this specific hospital
let totalBedFluctuations = 0;
let totalBloodFluctuations = 0;
let recentActivity = [];

/**
 * Generate a unique MedLink incident reference
 */
function generateIncidentNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SIM-${dateStr}-${suffix}`;
}

/**
 * Spawn a single high-fidelity incident into the live CAD system
 */
async function spawnIncident(customOptions = {}) {
  const client = await db.pool.connect();
  try {
    const scenario = JAMMU_INCIDENT_SCENARIOS[scenarioIndex % JAMMU_INCIDENT_SCENARIOS.length];
    scenarioIndex++;

    const triage = deriveStandardizedRequirements({
      chiefComplaint: scenario.chiefComplaint,
      conditionCategory: scenario.conditionCategory,
      vitalSigns: scenario.vitalSigns,
      patient: scenario.patient
    });

    await client.query('BEGIN');

    // 1. Insert Patient
    const pRes = await client.query(
      `INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        scenario.patient.name,
        scenario.patient.age,
        scenario.patient.gender,
        scenario.callerPhone,
        scenario.patient.medicalHistory,
        scenario.patient.allergies
      ]
    );
    const patientRecord = pRes.rows[0];

    // 2. Insert Incident
    const incidentNumber = generateIncidentNumber();
    const incRes = await client.query(
      `INSERT INTO emergency_incidents
        (incident_number, caller_name, caller_phone, patient_id, location,
         address, severity, triage_level, chief_complaint, condition_category,
         vital_signs, status, notes, created_at, updated_at)
       VALUES
        ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
         $7, $8, $9, $10, $11, $12, 'reported', $13, NOW(), NOW())
       RETURNING id, incident_number, caller_name, caller_phone, patient_id,
                 address, severity, triage_level, chief_complaint, condition_category,
                 vital_signs, status, created_at,
                 ST_Y(location::geometry) AS latitude,
                 ST_X(location::geometry) AS longitude`,
      [
        incidentNumber,
        scenario.callerName,
        scenario.callerPhone,
        patientRecord.id,
        scenario.lng,
        scenario.lat,
        scenario.address,
        triage.severity,
        triage.triageLevel,
        scenario.chiefComplaint,
        triage.conditionCategory,
        JSON.stringify(scenario.vitalSigns || {}),
        scenario.notes
      ]
    );
    const createdIncident = incRes.rows[0];
    const incidentId = createdIncident.id;

    // 3. Insert Derived Resource Requirements
    const insertedReqs = [];
    for (const r of triage.requiredResources) {
      const resItem = await client.query(
        `INSERT INTO incident_resource_requirements
          (incident_id, required_resource_type, required_quantity, priority, justification)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [incidentId, r.requiredResourceType, r.requiredQuantity, r.priority, r.justification]
      );
      insertedReqs.push(resItem.rows[0]);
    }

    for (const s of triage.requiredSpecialists) {
      const specItem = await client.query(
        `INSERT INTO incident_resource_requirements
          (incident_id, required_specialty, specialist_count, priority, justification)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [incidentId, s.requiredSpecialty, s.specialistCount, s.priority, s.justification]
      );
      insertedReqs.push(specItem.rows[0]);
    }

    await client.query('COMMIT');

    totalSimulated++;
    lastSpawnedAt = new Date().toISOString();
    lastSpawnedIncident = {
      id: createdIncident.id,
      incidentNumber: createdIncident.incident_number,
      address: createdIncident.address,
      conditionCategory: createdIncident.condition_category,
      severity: createdIncident.severity,
      patientName: patientRecord.name,
      timestamp: lastSpawnedAt
    };
    console.log(`⚡ [Simulator] Generated Incident #${createdIncident.incident_number} in ${createdIncident.address}`);

    // 4. Broadcast Real-Time New Incident via WebSockets
    socketService.broadcastNewIncident({
      ...createdIncident,
      patient_name: patientRecord.name,
      patient_age: patientRecord.age,
      patient_gender: patientRecord.gender,
      requirements: insertedReqs
    });

    // 5. Trigger Coordination Engine Dispatch with MCDM Ranking
    const targetPrefHospitalId = customOptions.targetHospitalId || pinnedHospitalId || scenario.preferredHospitalId;
    const dispatchResult = await coordinationEngine.startDispatch(incidentId, {
      timeoutSeconds: 45,
      radiusMeters: 40000,
      preferredHospitalId: targetPrefHospitalId
    });

    // 6. Realistic Lifecycle Progress (if autoProgress enabled)
    if (autoProgress && dispatchResult && dispatchResult.success && dispatchResult.targetHospital) {
      const targetHospitalId = dispatchResult.targetHospital.id;
      const targetHospitalName = dispatchResult.targetHospital.name;

      // Step A: Hospital Accepts after 14 seconds
      setTimeout(async () => {
        try {
          const checkRes = await db.query('SELECT status FROM emergency_incidents WHERE id = $1', [incidentId]);
          if (!checkRes.rowCount || checkRes.rows[0].status !== 'requested') return;

          console.log(`🏥 [Simulator] Auto-accepting Incident #${incidentId} for ${targetHospitalName}`);
          await coordinationEngine.handleHospitalResponse(
            incidentId,
            targetHospitalId,
            'accept',
            'Simulated ER Bed & Trauma Team Acknowledged'
          );

          // Step B: Ambulance En Route after 14 more seconds
          setTimeout(async () => {
            try {
              const checkRes2 = await db.query('SELECT status FROM emergency_incidents WHERE id = $1', [incidentId]);
              if (!checkRes2.rowCount || checkRes2.rows[0].status !== 'assigned') return;

              console.log(`🚑 [Simulator] Incident #${incidentId} status -> en_route`);
              await db.query(
                `UPDATE emergency_incidents SET status = 'en_route', updated_at = NOW() WHERE id = $1`,
                [incidentId]
              );
              socketService.broadcastIncidentStatus(incidentId, 'en_route', {
                assignedHospitalId: targetHospitalId,
                assignedHospitalName: targetHospitalName
              });

              // Step C: Arrived at Hospital Bay after 16 more seconds
              setTimeout(async () => {
                try {
                  const checkRes3 = await db.query('SELECT status FROM emergency_incidents WHERE id = $1', [incidentId]);
                  if (!checkRes3.rowCount || checkRes3.rows[0].status !== 'en_route') return;

                  console.log(`🏁 [Simulator] Incident #${incidentId} status -> arrived`);
                  await db.query(
                    `UPDATE emergency_incidents SET status = 'arrived', updated_at = NOW() WHERE id = $1`,
                    [incidentId]
                  );
                  socketService.broadcastIncidentStatus(incidentId, 'arrived', {
                    assignedHospitalId: targetHospitalId,
                    assignedHospitalName: targetHospitalName
                  });

                  // Step D: Auto-resolve incident after clinical triage and treatment (8 seconds)
                  setTimeout(async () => {
                    try {
                      const checkRes4 = await db.query('SELECT status FROM emergency_incidents WHERE id = $1', [incidentId]);
                      if (!checkRes4.rowCount || checkRes4.rows[0].status !== 'arrived') return;

                      console.log(`✅ [Simulator] Incident #${incidentId} status -> resolved (Treatment Complete)`);
                      await db.query(
                        `UPDATE emergency_incidents SET status = 'resolved', updated_at = NOW() WHERE id = $1`,
                        [incidentId]
                      );
                      socketService.broadcastIncidentStatus(incidentId, 'resolved', {
                        assignedHospitalId: targetHospitalId,
                        assignedHospitalName: targetHospitalName
                      });

                      // Step E: Automatically delete resolved case to free up cache and database space (3 seconds)
                      setTimeout(async () => {
                        try {
                          console.log(`🧹 [Simulator] Purging resolved incident #${incidentId} to free up cache space`);
                          await db.query(`DELETE FROM emergency_incidents WHERE id = $1`, [incidentId]);
                          socketService.broadcastIncidentDeleted(incidentId);
                        } catch (delErr) {
                          console.warn('Simulator purge resolved incident error:', delErr.message);
                        }
                      }, 3000);

                    } catch (e4) {
                      console.warn('Simulator auto-resolve step warning:', e4.message);
                    }
                  }, 8000);

                } catch (e3) {
                  console.warn('Simulator arrival step warning:', e3.message);
                }
              }, 16000);

            } catch (e2) {
              console.warn('Simulator en_route step warning:', e2.message);
            }
          }, 14000);

        } catch (e1) {
          console.warn('Simulator auto-accept warning:', e1.message);
        }
      }, 14000);
    }

    return {
      success: true,
      incident: createdIncident,
      patient: patientRecord
    };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [Simulator] Error spawning incident:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Autonomous pulse: Automatically consumes and empties beds,
 * and automatically uses and fills blood banks across regional hospitals.
 */
async function pulseHospitalResources() {
  if (!isRunning) return;

  try {
    const activityLog = [];

    const hospRes = await db.query(
      `SELECT id, name FROM hospitals WHERE operational_status = 'operational' ORDER BY id ASC`
    );
    if (hospRes.rows.length === 0) return;

    const allHospitals = hospRes.rows;
    // Pick 1 to 2 random hospitals to update on this pulse
    const countToPick = Math.min(allHospitals.length, Math.floor(Math.random() * 2) + 1);
    const shuffled = [...allHospitals].sort(() => 0.5 - Math.random());
    const selectedHospitals = shuffled.slice(0, countToPick);

    // 1. AUTO BEDS: Auto-use (admissions) and Auto-empty (discharges)
    if (autoBeds) {
      for (const hosp of selectedHospitals) {
        const isIcu = Math.random() < 0.45;
        const isAdmission = Math.random() < 0.55;
        const delta = isIcu ? 1 : Math.floor(Math.random() * 2) + 1;

        const typeFilter = isIcu
          ? "resource_type ILIKE '%icu%'"
          : "(resource_type ILIKE '%general%' OR resource_type ILIKE '%ward%' OR resource_type ILIKE '%bed%') AND resource_type NOT ILIKE '%icu%'";

        if (isAdmission) {
          // Auto-use: Patient admitted / surgery
          const updateRes = await db.query(`
            UPDATE hospital_resources
            SET available_quantity = GREATEST(0, available_quantity - $1),
                status = CASE WHEN GREATEST(0, available_quantity - $1) = 0 THEN 'unavailable' ELSE 'available' END,
                updated_at = NOW()
            WHERE hospital_id = $2 AND ${typeFilter} AND total_quantity > 0
            RETURNING resource_type, available_quantity, total_quantity
          `, [delta, hosp.id]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBedFluctuations++;
            const msg = `🛏️ ${hosp.name}: Patient admitted (${delta} ${isIcu ? 'ICU' : 'Ward'} bed occupied -> ${row.available_quantity}/${row.total_quantity} left)`;
            activityLog.push(msg);
            socketService.broadcastHospitalUpdate(hosp.id, {
              simulated: true,
              type: 'bed_auto_pulse',
              message: msg,
              resourcesUpdated: updateRes.rows
            });
          }
        } else {
          // Auto-empty: Patient discharged / bed freed
          const updateRes = await db.query(`
            UPDATE hospital_resources
            SET available_quantity = LEAST(total_quantity, available_quantity + $1),
                status = 'available',
                updated_at = NOW()
            WHERE hospital_id = $2 AND ${typeFilter} AND total_quantity > 0
            RETURNING resource_type, available_quantity, total_quantity
          `, [delta, hosp.id]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBedFluctuations++;
            const msg = `🛏️ ${hosp.name}: Patient discharged (${delta} ${isIcu ? 'ICU' : 'Ward'} bed freed -> ${row.available_quantity}/${row.total_quantity} available)`;
            activityLog.push(msg);
            socketService.broadcastHospitalUpdate(hosp.id, {
              simulated: true,
              type: 'bed_auto_pulse',
              message: msg,
              resourcesUpdated: updateRes.rows
            });
          }
        }
      }
    }

    // 2. AUTO BLOOD BANKS: Auto-use (transfusions) and Auto-fill (donor restock)
    if (autoBlood) {
      for (const hosp of selectedHospitals) {
        const isConsumption = Math.random() < 0.5;
        const delta = Math.floor(Math.random() * 3) + 1;
        const groups = ['O- (Universal Red Cell)', 'O+ (Positive)', 'A+ (Positive)', 'B+ (Positive)'];
        const chosenGroup = groups[Math.floor(Math.random() * groups.length)];

        if (isConsumption) {
          // Auto-use: Emergency trauma transfusion
          const updateRes = await db.query(`
            UPDATE hospital_blood_inventory
            SET units_available = GREATEST(1, units_available - $1),
                status = CASE WHEN GREATEST(1, units_available - $1) < 5 THEN 'critical' ELSE 'available' END,
                updated_at = NOW()
            WHERE hospital_id = $2 AND blood_group = $3
            RETURNING blood_group, units_available
          `, [delta, hosp.id, chosenGroup]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBloodFluctuations++;
            const shortName = chosenGroup.split(' ')[0];
            const msg = `🩸 ${hosp.name}: Transfusion used ${delta} units of ${shortName} blood (${row.units_available} units left)`;
            activityLog.push(msg);
            socketService.broadcastBloodUpdate(hosp.id, {
              simulated: true,
              type: 'blood_auto_pulse',
              message: msg,
              bloodUpdated: updateRes.rows
            });
          }
        } else {
          // Auto-fill: Blood bank donation drive restock
          const fillUnits = Math.floor(Math.random() * 4) + 2;
          const updateRes = await db.query(`
            UPDATE hospital_blood_inventory
            SET units_available = LEAST(60, units_available + $1),
                status = 'available',
                updated_at = NOW()
            WHERE hospital_id = $2 AND blood_group = $3
            RETURNING blood_group, units_available
          `, [fillUnits, hosp.id, chosenGroup]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBloodFluctuations++;
            const shortName = chosenGroup.split(' ')[0];
            const msg = `🩸 ${hosp.name}: Donor delivery added +${fillUnits} units of ${shortName} blood (${row.units_available} units in stock)`;
            activityLog.push(msg);
            socketService.broadcastBloodUpdate(hosp.id, {
              simulated: true,
              type: 'blood_auto_pulse',
              message: msg,
              bloodUpdated: updateRes.rows
            });
          }
        }
      }
    }

    if (activityLog.length > 0) {
      recentActivity = [...activityLog, ...recentActivity].slice(0, 15);
      console.log(`⚡ [Simulator:Pulse] ${activityLog.join(' | ')}`);
    }

    // Auto-resolve arrived incidents and sweep completed cases
    await autoResolveLingeringIncidents();

  } catch (err) {
    console.warn('⚠️ [Simulator:Pulse] Resource pulse error:', err.message);
  }
}

/**
 * High-cadence blood bank dynamics: actively fluctuates blood stocks across regional hospitals
 * so units jump continuously and realistically in real-time.
 */
async function pulseBloodBanks() {
  if (!isRunning || !autoBlood) return;
  try {
    const hospRes = await db.query(`SELECT id, name FROM hospitals WHERE operational_status = 'operational' ORDER BY name ASC`);
    const allHospitals = hospRes.rows;
    if (allHospitals.length === 0) return;

    // Pick 2 to 3 hospitals to dynamically fluctuate on this jump
    const countToPick = Math.min(allHospitals.length, Math.floor(Math.random() * 2) + 2);
    const shuffled = [...allHospitals].sort(() => 0.5 - Math.random());
    const selectedHospitals = shuffled.slice(0, countToPick);

    const groups = [
      'O- (Universal Red Cell)',
      'O+ (Positive)',
      'A+ (Positive)',
      'B+ (Positive)',
      'AB+ (Positive)'
    ];

    const activityLog = [];

    for (const hosp of selectedHospitals) {
      // Pick 1 to 2 blood groups per hospital
      const groupsToUpdateCount = Math.floor(Math.random() * 2) + 1;
      const chosenGroups = [...groups].sort(() => 0.5 - Math.random()).slice(0, groupsToUpdateCount);

      for (const chosenGroup of chosenGroups) {
        const isConsumption = Math.random() < 0.55;
        const shortName = chosenGroup.split(' ')[0];

        if (isConsumption) {
          // Emergency trauma transfusion
          const delta = Math.floor(Math.random() * 3) + 1;
          const updateRes = await db.query(`
            UPDATE hospital_blood_inventory
            SET units_available = GREATEST(2, units_available - $1),
                status = CASE WHEN GREATEST(2, units_available - $1) < 5 THEN 'critical' ELSE 'available' END,
                updated_at = NOW()
            WHERE hospital_id = $2 AND blood_group = $3
            RETURNING blood_group, units_available
          `, [delta, hosp.id, chosenGroup]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBloodFluctuations++;
            const msg = `🩸 ${hosp.name}: Transfusion used ${delta} units of ${shortName} blood (${row.units_available} units left)`;
            activityLog.push(msg);
            socketService.broadcastBloodUpdate(hosp.id, {
              simulated: true,
              type: 'blood_auto_pulse',
              message: msg,
              bloodUpdated: updateRes.rows
            });
          }
        } else {
          // Community donor delivery
          const fillUnits = Math.floor(Math.random() * 4) + 2;
          const updateRes = await db.query(`
            UPDATE hospital_blood_inventory
            SET units_available = LEAST(60, units_available + $1),
                status = 'available',
                updated_at = NOW()
            WHERE hospital_id = $2 AND blood_group = $3
            RETURNING blood_group, units_available
          `, [fillUnits, hosp.id, chosenGroup]);

          if (updateRes.rows.length > 0) {
            const row = updateRes.rows[0];
            totalBloodFluctuations++;
            const msg = `🩸 ${hosp.name}: Donor delivery added +${fillUnits} units of ${shortName} blood (${row.units_available} units in stock)`;
            activityLog.push(msg);
            socketService.broadcastBloodUpdate(hosp.id, {
              simulated: true,
              type: 'blood_auto_pulse',
              message: msg,
              bloodUpdated: updateRes.rows
            });
          }
        }
      }
    }

    if (activityLog.length > 0) {
      recentActivity = [...activityLog, ...recentActivity].slice(0, 20);
      console.log(`🩸 [Simulator:BloodJump] ${activityLog.slice(0, 2).join(' | ')}`);
    }

  } catch (err) {
    console.warn('⚠️ [Simulator:BloodJump] Blood fluctuation error:', err.message);
  }
}

/**
 * Auto-resolves lingering arrived/completed incidents and purges resolved cases to free up cache space
 */
async function autoResolveLingeringIncidents() {
  try {
    // 1. Auto-resolve any incidents in 'arrived' state older than 8 seconds
    const arrivedRes = await db.query(`
      SELECT id, incident_number, assigned_hospital_id 
      FROM emergency_incidents 
      WHERE status = 'arrived' 
        AND updated_at < NOW() - INTERVAL '8 seconds'
      LIMIT 10
    `);

    for (const row of arrivedRes.rows) {
      console.log(`✅ [Simulator:Sweep] Auto-resolving arrived incident #${row.incident_number}`);
      await db.query(`UPDATE emergency_incidents SET status = 'resolved', updated_at = NOW() WHERE id = $1`, [row.id]);
      socketService.broadcastIncidentStatus(row.id, 'resolved', { assignedHospitalId: row.assigned_hospital_id });
    }

    // 2. Delete any incidents in 'resolved' or 'closed' state older than 2 seconds
    const resolvedRes = await db.query(`
      DELETE FROM emergency_incidents 
      WHERE status IN ('resolved', 'closed') 
        AND updated_at < NOW() - INTERVAL '2 seconds'
      RETURNING id, incident_number
    `);

    for (const del of resolvedRes.rows) {
      console.log(`🧹 [Simulator:Sweep] Freeing cache space: Purged resolved incident #${del.incident_number}`);
      socketService.broadcastIncidentDeleted(del.id);
    }

    // 3. Auto-progress stale simulated incidents stuck in 'en_route' older than 35 seconds
    const staleEnRoute = await db.query(`
      SELECT id, incident_number, assigned_hospital_id
      FROM emergency_incidents
      WHERE status = 'en_route'
        AND incident_number LIKE 'SIM-%'
        AND updated_at < NOW() - INTERVAL '35 seconds'
      LIMIT 5
    `);

    for (const row of staleEnRoute.rows) {
      console.log(`🏁 [Simulator:Sweep] Auto-arriving stale en_route incident #${row.incident_number}`);
      await db.query(`UPDATE emergency_incidents SET status = 'arrived', updated_at = NOW() WHERE id = $1`, [row.id]);
      socketService.broadcastIncidentStatus(row.id, 'arrived', { assignedHospitalId: row.assigned_hospital_id });
    }

    // 4. Auto-progress stale requested incidents older than 45 seconds (auto-assign to GMC Jammu or SMGS)
    const staleRequested = await db.query(`
      SELECT id, incident_number, current_dispatch_hospital_id
      FROM emergency_incidents
      WHERE status = 'requested'
        AND incident_number LIKE 'SIM-%'
        AND updated_at < NOW() - INTERVAL '45 seconds'
      LIMIT 5
    `);

    for (const row of staleRequested.rows) {
      const fallbackHospId = row.current_dispatch_hospital_id || 4;
      console.log(`🚑 [Simulator:Sweep] Auto-dispatching stale requested incident #${row.incident_number}`);
      await db.query(`UPDATE emergency_incidents SET status = 'en_route', assigned_hospital_id = $1, updated_at = NOW() WHERE id = $2`, [fallbackHospId, row.id]);
      socketService.broadcastIncidentStatus(row.id, 'en_route', { assignedHospitalId: fallbackHospId });
    }

  } catch (sweepErr) {
    console.warn('⚠️ [Simulator:Sweep] Incident sweep error:', sweepErr.message);
  }
}

/**
 * Start the continuous background simulation
 */
function start(interval = currentIntervalMs) {
  if (isRunning) return;
  isRunning = true;
  currentIntervalMs = interval;
  console.log(`🚀 [Simulator] Autonomous Simulator STARTED (CAD calls: ${interval / 1000}s, Auto-Resources: ${resourceIntervalMs / 1000}s)`);

  // Initial sweep of any existing/lingering cases
  setTimeout(() => {
    if (isRunning) autoResolveLingeringIncidents().catch(() => {});
  }, 1000);

  // Spawn initial incident shortly after start
  setTimeout(() => {
    if (isRunning) spawnIncident().catch(() => {});
  }, 2500);

  // Initial resource pulse shortly after start
  setTimeout(() => {
    if (isRunning) pulseHospitalResources().catch(() => {});
  }, 3500);

  // Initial blood jumping pulse shortly after start
  setTimeout(() => {
    if (isRunning && autoBlood) pulseBloodBanks().catch(() => {});
  }, 2000);

  timerInterval = setInterval(() => {
    if (isRunning) {
      spawnIncident().catch(() => {});
    }
  }, interval);

  resourceTimerInterval = setInterval(() => {
    if (isRunning) {
      pulseHospitalResources().catch(() => {});
    }
  }, resourceIntervalMs);

  bloodTimerInterval = setInterval(() => {
    if (isRunning && autoBlood) {
      pulseBloodBanks().catch(() => {});
    }
  }, bloodIntervalMs);
}

/**
 * Stop the background simulation
 */
function stop() {
  if (!isRunning) return;
  isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (resourceTimerInterval) {
    clearInterval(resourceTimerInterval);
    resourceTimerInterval = null;
  }
  if (bloodTimerInterval) {
    clearInterval(bloodTimerInterval);
    bloodTimerInterval = null;
  }
  console.log('🛑 [Simulator] Autonomous Simulator STOPPED.');
}

/**
 * Update simulator runtime configurations
 */
function setConfig({
  intervalSeconds,
  resourceIntervalSeconds,
  bloodIntervalSeconds,
  autoProgress: ap,
  autoBeds: ab,
  autoBlood: abl,
  targetHospitalId
}) {
  if (intervalSeconds && Number(intervalSeconds) >= 10) {
    currentIntervalMs = Number(intervalSeconds) * 1000;
    if (isRunning && timerInterval) {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (isRunning) spawnIncident().catch(() => {});
      }, currentIntervalMs);
    }
  }
  if (resourceIntervalSeconds && Number(resourceIntervalSeconds) >= 5) {
    resourceIntervalMs = Number(resourceIntervalSeconds) * 1000;
    if (isRunning && resourceTimerInterval) {
      clearInterval(resourceTimerInterval);
      resourceTimerInterval = setInterval(() => {
        if (isRunning) pulseHospitalResources().catch(() => {});
      }, resourceIntervalMs);
    }
  }
  if (bloodIntervalSeconds && Number(bloodIntervalSeconds) >= 2) {
    bloodIntervalMs = Number(bloodIntervalSeconds) * 1000;
    if (isRunning && bloodTimerInterval) {
      clearInterval(bloodTimerInterval);
      bloodTimerInterval = setInterval(() => {
        if (isRunning && autoBlood) pulseBloodBanks().catch(() => {});
      }, bloodIntervalMs);
    }
  }
  if (typeof ap === 'boolean') {
    autoProgress = ap;
  }
  if (typeof ab === 'boolean') {
    autoBeds = ab;
  }
  if (typeof abl === 'boolean') {
    autoBlood = abl;
  }
  if (targetHospitalId !== undefined) {
    pinnedHospitalId = (targetHospitalId && targetHospitalId !== 'all') ? Number(targetHospitalId) : null;
  }
  return getStatus();
}

/**
 * Clear simulated resolved cases
 */
async function clearResolvedCases() {
  const res = await db.query(
    `DELETE FROM emergency_incidents 
     WHERE status IN ('arrived', 'closed', 'cancelled') 
       AND incident_number LIKE 'SIM-%' 
     RETURNING id`
  );
  return { deletedCount: res.rowCount };
}

/**
 * Simulate bed utilization and capacity surges (ICU, General Ward, Empty/Saturate)
 */
async function simulateBeds({ hospitalId = null, bedType = 'all', action = 'consume', amount = 1 } = {}) {
  const targetHospId = (hospitalId && hospitalId !== 'all') ? Number(hospitalId) : null;
  const qty = Math.max(1, parseInt(amount, 10) || 1);

  let query = '';
  let params = [];
  let description = '';

  if (action === 'saturate' || action === 'zero') {
    // Fill/saturate all beds to 0 available (Emergency Zero-Capacity Crisis)
    query = `
      UPDATE hospital_resources
      SET available_quantity = 0,
          status = 'unavailable',
          updated_at = NOW()
      WHERE (resource_type ILIKE '%bed%' OR resource_type ILIKE '%icu%' OR resource_type ILIKE '%bay%')
        AND ($1::bigint IS NULL OR hospital_id = $1::bigint)
      RETURNING id, hospital_id, resource_type, total_quantity, available_quantity, status
    `;
    params = [targetHospId];
    description = targetHospId
      ? `Saturated all beds to 0 for Hospital #${targetHospId}`
      : 'Saturated all beds to 0 across all regional hospitals (Zero-Capacity Crisis)';

  } else if (action === 'empty' || action === 'reset' || action === 'restore') {
    // Empty beds / Reset to 100% capacity
    query = `
      UPDATE hospital_resources
      SET available_quantity = total_quantity,
          status = 'available',
          updated_at = NOW()
      WHERE (resource_type ILIKE '%bed%' OR resource_type ILIKE '%icu%' OR resource_type ILIKE '%bay%')
        AND ($1::bigint IS NULL OR hospital_id = $1::bigint)
      RETURNING id, hospital_id, resource_type, total_quantity, available_quantity, status
    `;
    params = [targetHospId];
    description = targetHospId
      ? `Reset all beds to 100% capacity for Hospital #${targetHospId}`
      : 'Reset all beds to 100% capacity across all regional hospitals';

  } else if (action === 'consume' || action === 'use') {
    // Occupy / Consume beds
    let typeClause = "(resource_type ILIKE '%bed%' OR resource_type ILIKE '%icu%' OR resource_type ILIKE '%bay%')";
    if (bedType === 'icu') {
      typeClause = "resource_type ILIKE '%icu%'";
    } else if (bedType === 'normal' || bedType === 'general') {
      typeClause = "(resource_type ILIKE '%general%' OR resource_type ILIKE '%ward%' OR resource_type ILIKE '%bed%') AND resource_type NOT ILIKE '%icu%'";
    }

    query = `
      UPDATE hospital_resources
      SET available_quantity = GREATEST(0, available_quantity - $1),
          status = CASE WHEN GREATEST(0, available_quantity - $1) = 0 THEN 'unavailable' ELSE 'available' END,
          updated_at = NOW()
      WHERE ${typeClause}
        AND ($2::bigint IS NULL OR hospital_id = $2::bigint)
      RETURNING id, hospital_id, resource_type, total_quantity, available_quantity, status
    `;
    params = [qty, targetHospId];
    description = `Consumed ${qty} ${bedType.toUpperCase()} bed(s) ${targetHospId ? `at Hospital #${targetHospId}` : 'regionally'}`;

  } else if (action === 'release' || action === 'add') {
    // Release / Free specific number of beds
    let typeClause = "(resource_type ILIKE '%bed%' OR resource_type ILIKE '%icu%' OR resource_type ILIKE '%bay%')";
    if (bedType === 'icu') {
      typeClause = "resource_type ILIKE '%icu%'";
    } else if (bedType === 'normal' || bedType === 'general') {
      typeClause = "(resource_type ILIKE '%general%' OR resource_type ILIKE '%ward%' OR resource_type ILIKE '%bed%') AND resource_type NOT ILIKE '%icu%'";
    }

    query = `
      UPDATE hospital_resources
      SET available_quantity = LEAST(total_quantity, available_quantity + $1),
          status = 'available',
          updated_at = NOW()
      WHERE ${typeClause}
        AND ($2::bigint IS NULL OR hospital_id = $2::bigint)
      RETURNING id, hospital_id, resource_type, total_quantity, available_quantity, status
    `;
    params = [qty, targetHospId];
    description = `Released ${qty} ${bedType.toUpperCase()} bed(s) ${targetHospId ? `at Hospital #${targetHospId}` : 'regionally'}`;
  } else {
    throw new Error(`Unknown bed simulation action: ${action}`);
  }

  const res = await db.query(query, params);

  // Broadcast updates via Socket.IO
  const affectedHospitals = [...new Set(res.rows.map(r => r.hospital_id))];
  for (const hId of affectedHospitals) {
    socketService.broadcastHospitalUpdate(hId, {
      simulated: true,
      resourcesUpdated: res.rows.filter(r => r.hospital_id === hId)
    });
  }

  return {
    success: true,
    action,
    bedType,
    description,
    affectedHospitalsCount: affectedHospitals.length,
    updatedRowsCount: res.rowCount,
    changes: res.rows.slice(0, 10)
  };
}

/**
 * Simulate blood bank operations (deplete, consume, fill, restock O-)
 */
async function simulateBlood({ hospitalId = null, action = 'fill', bloodGroup = null, amount = 10 } = {}) {
  const targetHospId = (hospitalId && hospitalId !== 'all') ? Number(hospitalId) : null;
  const qty = Math.max(1, parseInt(amount, 10) || 10);

  let query = '';
  let params = [];
  let description = '';

  if (action === 'deplete_critical' || action === 'empty') {
    // Drains blood to critical levels (< 3 units) to trigger shortage alarms
    query = `
      UPDATE hospital_blood_inventory
      SET units_available = CASE 
            WHEN blood_group ILIKE '%O-%' THEN 1
            WHEN blood_group ILIKE '%O+%' THEN 2
            ELSE 3 
          END,
          status = 'critical',
          updated_at = NOW()
      WHERE ($1::bigint IS NULL OR hospital_id = $1::bigint)
      RETURNING id, hospital_id, blood_group, units_available, status
    `;
    params = [targetHospId];
    description = targetHospId
      ? `Depleted blood reserves to critical shortage at Hospital #${targetHospId}`
      : 'Depleted regional blood reserves to critical emergency shortage (< 3 units)';

  } else if (action === 'fill' || action === 'restock') {
    // Fill / Restock blood bank to healthy surplus levels
    query = `
      UPDATE hospital_blood_inventory
      SET units_available = CASE
            WHEN blood_group ILIKE '%O-%' THEN 40
            WHEN blood_group ILIKE '%O+%' THEN 55
            ELSE 45
          END,
          status = 'available',
          updated_at = NOW()
      WHERE ($1::bigint IS NULL OR hospital_id = $1::bigint)
      RETURNING id, hospital_id, blood_group, units_available, status
    `;
    params = [targetHospId];
    description = targetHospId
      ? `Filled and restocked blood bank reserves to surplus at Hospital #${targetHospId}`
      : 'Filled and restocked all regional blood banks to optimal reserves (40-55 units)';

  } else if (action === 'consume' || action === 'use') {
    // Consume specific units
    query = `
      UPDATE hospital_blood_inventory
      SET units_available = GREATEST(0, units_available - $1),
          status = CASE WHEN GREATEST(0, units_available - $1) < 5 THEN 'critical' ELSE 'available' END,
          updated_at = NOW()
      WHERE ($2::bigint IS NULL OR hospital_id = $2::bigint)
        AND ($3::text IS NULL OR blood_group ILIKE '%' || $3 || '%')
      RETURNING id, hospital_id, blood_group, units_available, status
    `;
    params = [qty, targetHospId, bloodGroup];
    description = `Consumed ${qty} units of ${bloodGroup || 'all blood groups'} ${targetHospId ? `at Hospital #${targetHospId}` : 'regionally'}`;

  } else if (action === 'topup_o_neg') {
    // Top up emergency O- Universal Blood
    query = `
      UPDATE hospital_blood_inventory
      SET units_available = units_available + 20,
          status = 'available',
          updated_at = NOW()
      WHERE blood_group ILIKE '%O-%'
        AND ($1::bigint IS NULL OR hospital_id = $1::bigint)
      RETURNING id, hospital_id, blood_group, units_available, status
    `;
    params = [targetHospId];
    description = `Topped up Universal O- Blood (+20 units) ${targetHospId ? `at Hospital #${targetHospId}` : 'across all hospitals'}`;
  } else {
    throw new Error(`Unknown blood simulation action: ${action}`);
  }

  const res = await db.query(query, params);

  // Broadcast updates via Socket.IO
  const affectedHospitals = [...new Set(res.rows.map(r => r.hospital_id))];
  for (const hId of affectedHospitals) {
    socketService.broadcastBloodUpdate(hId, {
      simulated: true,
      bloodUpdated: res.rows.filter(r => r.hospital_id === hId)
    });
  }

  return {
    success: true,
    action,
    description,
    affectedHospitalsCount: affectedHospitals.length,
    updatedRowsCount: res.rowCount,
    changes: res.rows.slice(0, 10)
  };
}

/**
 * Execute pre-packaged scenario stress tests
 */
async function simulateScenario(scenarioName, { hospitalId = null } = {}) {
  const targetHospId = (hospitalId && hospitalId !== 'all') ? Number(hospitalId) : null;

  if (scenarioName === 'mci') {
    // Mass Casualty Incident: Consume 4 ICU beds, 8 General beds, 6 units of O- blood, and spawn 2 emergencies
    await simulateBeds({ hospitalId: targetHospId, bedType: 'icu', action: 'consume', amount: 4 });
    await simulateBeds({ hospitalId: targetHospId, bedType: 'normal', action: 'consume', amount: 8 });
    await simulateBlood({ hospitalId: targetHospId, action: 'consume', bloodGroup: 'O-', amount: 6 });
    const inc1 = await spawnIncident({ targetHospitalId: targetHospId });
    const inc2 = await spawnIncident({ targetHospitalId: targetHospId });

    return {
      success: true,
      scenario: 'mci',
      description: '🚨 Mass Casualty Incident (MCI) active! Consumed 4 ICU beds, 8 General beds, 6 O- blood units, and injected 2 urgent emergencies.',
      incidents: [inc1.incident?.incident_number, inc2.incident?.incident_number]
    };

  } else if (scenarioName === 'zero_beds') {
    // Zero Beds Crisis
    const res = await simulateBeds({ hospitalId: targetHospId, action: 'saturate' });
    return {
      success: true,
      scenario: 'zero_beds',
      description: '🏥 Zero-Capacity Bed Saturation active! All beds set to 0 to test diversion & automated hospital rerouting.',
      details: res
    };

  } else if (scenarioName === 'blood_shortage') {
    // Critical Blood Shortage
    const res = await simulateBlood({ hospitalId: targetHospId, action: 'deplete_critical' });
    return {
      success: true,
      scenario: 'blood_shortage',
      description: '🩸 Critical Blood Shortage active! Drained all blood banks below emergency safety thresholds (< 3 units).',
      details: res
    };

  } else if (scenarioName === 'replenish_all') {
    // Full Reset & Replenish
    const bedsRes = await simulateBeds({ hospitalId: targetHospId, action: 'empty' });
    const bloodRes = await simulateBlood({ hospitalId: targetHospId, action: 'fill' });
    const cleared = await clearResolvedCases();

    return {
      success: true,
      scenario: 'replenish_all',
      description: '✨ System Fully Replenished! Restored 100% bed availability, refilled all blood bank reserves to surplus, and cleared resolved cases.',
      bedsReset: bedsRes.updatedRowsCount,
      bloodRestocked: bloodRes.updatedRowsCount,
      clearedSimulations: cleared.deletedCount
    };

  } else {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }
}

/**
 * Return current simulator state
 */
function getStatus() {
  return {
    isRunning,
    intervalSeconds: currentIntervalMs / 1000,
    resourceIntervalSeconds: resourceIntervalMs / 1000,
    bloodIntervalSeconds: bloodIntervalMs / 1000,
    autoProgress,
    autoBeds,
    autoBlood,
    targetHospitalId: pinnedHospitalId,
    totalSimulated,
    totalBedFluctuations,
    totalBloodFluctuations,
    recentActivity,
    lastSpawnedAt,
    lastSpawnedIncident
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  setConfig,
  clearResolvedCases,
  spawnIncident,
  simulateBeds,
  simulateBlood,
  simulateScenario
};
