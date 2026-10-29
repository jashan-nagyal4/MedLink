/**
 * Migration Script: Seed GMC Jammu 51 Specialist Doctors & 24/7 Emergency Roster
 * 
 * Adds all 51 faculty doctors across 18 departments to Government Medical College (GMC Jammu)
 * with rotational 24/7 emergency shifts (Morning, Evening, Night) and clinical emergency duty assignments.
 */

require("dotenv").config();
const db = require("../src/config/db");

const DOCTORS_DATA = [
  // 1. General Medicine (Internal Medicine)
  {
    sno: 1,
    department: "General Medicine",
    doctor_name: "Dr. Fayaz Ahmad Wani",
    specialty: "Internal Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Medical Triage & Acute Resuscitation Bay Lead",
    contact_phone: "+91-191-2584290 (Ext: 101)"
  },
  {
    sno: 2,
    department: "General Medicine",
    doctor_name: "Dr. Vijant Singh Chandail",
    specialty: "Internal Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Medical Admissions & Intermediate ICU Handover",
    contact_phone: "+91-191-2584290 (Ext: 102)"
  },
  {
    sno: 3,
    department: "General Medicine",
    doctor_name: "Dr. Vishali Kotwal",
    specialty: "Internal Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Emergency Medical On-Call & Sepsis Protocol",
    contact_phone: "+91-191-2584290 (Ext: 103)"
  },

  // 2. Cardiology
  {
    sno: 4,
    department: "Cardiology",
    doctor_name: "Dr. Sushil Kumar Sharma",
    specialty: "Cardiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "STEMI Fast-Track Intervention & Cath Lab Emergency Lead",
    contact_phone: "+91-191-2584290 (Ext: 104)"
  },
  {
    sno: 5,
    department: "Cardiology",
    doctor_name: "Dr. Dharminder Kumar",
    specialty: "Cardiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Coronary Care & Arrhythmia Defibrillation Desk",
    contact_phone: "+91-191-2584290 (Ext: 105)"
  },
  {
    sno: 6,
    department: "Cardiology",
    doctor_name: "Dr. Sanjeev Bhat",
    specialty: "Cardiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Cardiac ICU & Overnight Emergency Reperfusion Call",
    contact_phone: "+91-191-2584290 (Ext: 106)"
  },

  // 3. ENT (Ear, Nose and Throat)
  {
    sno: 7,
    department: "ENT",
    doctor_name: "Dr. Parmod Kalsotra",
    specialty: "Ear, Nose and Throat",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Airway Obstruction & Emergency Tracheostomy Team",
    contact_phone: "+91-191-2584290 (Ext: 107)"
  },
  {
    sno: 8,
    department: "ENT",
    doctor_name: "Dr. Sonika Kanotra",
    specialty: "Ear, Nose and Throat",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Severe Epistaxis, Facial Trauma & Foreign Body Removal",
    contact_phone: "+91-191-2584290 (Ext: 108)"
  },
  {
    sno: 9,
    department: "ENT",
    doctor_name: "Dr. Kamal Kishore",
    specialty: "Ear, Nose and Throat",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight ENT Emergency Call & Laryngeal Trauma Standby",
    contact_phone: "+91-191-2584290 (Ext: 109)"
  },

  // 4. Obstetrics & Gynaecology
  {
    sno: 10,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Robina Mirza",
    specialty: "Obstetrics and Gynaecology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Labor Suite & Acute Fetal Distress Response",
    contact_phone: "+91-191-2584290 (Ext: 110)"
  },
  {
    sno: 11,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Reema Khajuria",
    specialty: "Obstetrics and Gynaecology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Cesarean & Postpartum Hemorrhage (PPH) Team",
    contact_phone: "+91-191-2584290 (Ext: 111)"
  },
  {
    sno: 12,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Jyotsana Lamba",
    specialty: "Obstetrics and Gynaecology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight High-Risk Obstetric Admissions & Eclampsia Call",
    contact_phone: "+91-191-2584290 (Ext: 112)"
  },

  // 5. Paediatrics
  {
    sno: 13,
    department: "Paediatrics",
    doctor_name: "Dr. Sanjeev Kumar Digra",
    specialty: "Paediatrics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Pediatric Emergency Resuscitation & PICU/NICU Intake",
    contact_phone: "+91-191-2584290 (Ext: 113)"
  },
  {
    sno: 14,
    department: "Paediatrics",
    doctor_name: "Dr. Ashu Jamwal",
    specialty: "Paediatrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Pediatric Status Epilepticus & Bronchiolitis Care",
    contact_phone: "+91-191-2584290 (Ext: 114)"
  },
  {
    sno: 15,
    department: "Paediatrics",
    doctor_name: "Dr. Sunil Dutt Sharma",
    specialty: "Paediatrics",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Neonatal & Pediatric Critical Care On-Call",
    contact_phone: "+91-191-2584290 (Ext: 115)"
  },

  // 6. Ophthalmology
  {
    sno: 16,
    department: "Ophthalmology",
    doctor_name: "Dr. Ashok K. Sharma",
    specialty: "Ophthalmology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Ruptured Globe, Acute Glaucoma & Chemical Ocular Burns",
    contact_phone: "+91-191-2584290 (Ext: 116)"
  },
  {
    sno: 17,
    department: "Ophthalmology",
    doctor_name: "Dr. Sanjay Kai",
    specialty: "Ophthalmology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Perforating Eye Injuries & Cornea Trauma Emergency Desk",
    contact_phone: "+91-191-2584290 (Ext: 117)"
  },
  {
    sno: 18,
    department: "Ophthalmology",
    doctor_name: "Dr. Hansraj Sharma",
    specialty: "Ophthalmology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Ophthalmic Trauma & Intraocular Foreign Body Call",
    contact_phone: "+91-191-2584290 (Ext: 118)"
  },

  // 7. Pathology
  {
    sno: 19,
    department: "Pathology",
    doctor_name: "Dr. Jyotsna Suri",
    specialty: "Pathology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "STAT Emergency Blood Film & Acute Leukemia Verification",
    contact_phone: "+91-191-2584290 (Ext: 119)"
  },
  {
    sno: 20,
    department: "Pathology",
    doctor_name: "Dr. Deepti Mahajan",
    specialty: "Pathology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Critical Coagulopathy (DIC) & Platelet Dysfunction Screen",
    contact_phone: "+91-191-2584290 (Ext: 120)"
  },
  {
    sno: 21,
    department: "Pathology",
    doctor_name: "Dr. Sindhu Sharma",
    specialty: "Pathology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Urgent Hematology & Body Fluid Analysis On-Call",
    contact_phone: "+91-191-2584290 (Ext: 121)"
  },

  // 8. Microbiology
  {
    sno: 22,
    department: "Microbiology",
    doctor_name: "Dr. Sandeep Dogra",
    specialty: "Microbiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Rapid Sepsis Blood Culture & STAT CSF Gram Stain Lead",
    contact_phone: "+91-191-2584290 (Ext: 122)"
  },
  {
    sno: 23,
    department: "Microbiology",
    doctor_name: "Dr. Harleen Kaur",
    specialty: "Microbiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Infectious Outbreak & Multidrug-Resistant Sepsis Advisory",
    contact_phone: "+91-191-2584290 (Ext: 123)"
  },
  {
    sno: 24,
    department: "Microbiology",
    doctor_name: "Dr. Sikander Chirag",
    specialty: "Microbiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Critical Pathogen Verification & Bio-Defense",
    contact_phone: "+91-191-2584290 (Ext: 124)"
  },

  // 9. Pharmacology
  {
    sno: 25,
    department: "Pharmacology",
    doctor_name: "Dr. Seema Gupta",
    specialty: "Pharmacology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Antidotes, Poisoning & Acute Toxicology Desk",
    contact_phone: "+91-191-2584290 (Ext: 125)"
  },
  {
    sno: 26,
    department: "Pharmacology",
    doctor_name: "Dr. Shabnam Choudhary",
    specialty: "Pharmacology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Critical ICU Drug Interactions & Vasopressor Dosing",
    contact_phone: "+91-191-2584290 (Ext: 126)"
  },
  {
    sno: 27,
    department: "Pharmacology",
    doctor_name: "Dr. Vishal R. Tandon",
    specialty: "Pharmacology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Toxicological Emergency & Adverse Drug Reaction Call",
    contact_phone: "+91-191-2584290 (Ext: 127)"
  },

  // 10. Psychiatry
  {
    sno: 28,
    department: "Psychiatry",
    doctor_name: "Dr. Manu Arora",
    specialty: "Psychiatry",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Psychotic Crisis, Severe Agitation & De-escalation",
    contact_phone: "+91-191-2584290 (Ext: 128)"
  },
  {
    sno: 29,
    department: "Psychiatry",
    doctor_name: "Dr. Shabnam Rivees",
    specialty: "Psychiatry",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Suicide Attempt Intervention & Acute Trauma Counseling",
    contact_phone: "+91-191-2584290 (Ext: 129)"
  },
  {
    sno: 30,
    department: "Psychiatry",
    doctor_name: "Dr. Rakesh Banal",
    specialty: "Psychiatry",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Delirium Tremens & Severe Substance Withdrawal Call",
    contact_phone: "+91-191-2584290 (Ext: 130)"
  },

  // 11. Radiodiagnosis
  {
    sno: 31,
    department: "Radiodiagnosis",
    doctor_name: "Dr. Vipan Mangotra",
    specialty: "Radiodiagnosis",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Trauma Whole-Body Pan-Scan & Stroke CT Brain Team Lead",
    contact_phone: "+91-191-2584290 (Ext: 131)"
  },
  {
    sno: 32,
    department: "Radiodiagnosis",
    doctor_name: "Dr. Rajesh Sharma",
    specialty: "Radiodiagnosis",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Ultrasonography, FAST Scan & Internal Bleed ID",
    contact_phone: "+91-191-2584290 (Ext: 132)"
  },
  {
    sno: 33,
    department: "Radiodiagnosis",
    doctor_name: "Dr. Vikrant Gupta",
    specialty: "Radiodiagnosis",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Emergency CT Angiography & Aortic Dissection Scan",
    contact_phone: "+91-191-2584290 (Ext: 133)"
  },

  // 12. Radiotherapy (Radiation Oncology)
  {
    sno: 34,
    department: "Radiotherapy",
    doctor_name: "Dr. Ashutosh Gupta",
    specialty: "Radiation Oncology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Spinal Cord Compression Decompression Lead",
    contact_phone: "+91-191-2584290 (Ext: 134)"
  },
  {
    sno: 35,
    department: "Radiotherapy",
    doctor_name: "Dr. Rahul Sharma",
    specialty: "Radiation Oncology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Superior Vena Cava (SVC) Syndrome Emergency Radiation",
    contact_phone: "+91-191-2584290 (Ext: 135)"
  },
  {
    sno: 36,
    department: "Radiotherapy",
    doctor_name: "Dr. Sandeep Kour",
    specialty: "Radiation Oncology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Acute Tumor Hemorrhage & Palliative STAT Radiotherapy",
    contact_phone: "+91-191-2584290 (Ext: 136)"
  },

  // 13. Dermatology
  {
    sno: 37,
    department: "Dermatology",
    doctor_name: "Dr. Dev Raj Dogra",
    specialty: "Dermatology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Toxic Epidermal Necrolysis (TEN) & Stevens-Johnson Syndrome",
    contact_phone: "+91-191-2584290 (Ext: 137)"
  },
  {
    sno: 38,
    department: "Dermatology",
    doctor_name: "Dr. Naina Kala Dogra",
    specialty: "Dermatology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Angioedema, Pemphigus Vulgaris & Cutaneous Emergency",
    contact_phone: "+91-191-2584290 (Ext: 138)"
  },
  {
    sno: 39,
    department: "Dermatology",
    doctor_name: "Dr. Mashkoor Ahmed",
    specialty: "Dermatology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Severe Exfoliative Erythroderma Critical Care",
    contact_phone: "+91-191-2584290 (Ext: 139)"
  },

  // 14. Neurology
  {
    sno: 40,
    department: "Neurology",
    doctor_name: "Dr. B. R. Kundal",
    specialty: "Neurology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Ischemic Stroke Golden-Hour Thrombolysis / IV rtPA",
    contact_phone: "+91-191-2584290 (Ext: 140)"
  },
  {
    sno: 41,
    department: "Neurology",
    doctor_name: "Dr. Anupama Shah",
    specialty: "Neurology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Refractory Status Epilepticus & Myasthenic Crisis Care",
    contact_phone: "+91-191-2584290 (Ext: 141)"
  },

  // 15. Urology
  {
    sno: 42,
    department: "Urology",
    doctor_name: "Dr. Elias Sharma",
    specialty: "Urology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Testicular Torsion, Penile Fracture & Ureteric Rupture",
    contact_phone: "+91-191-2584290 (Ext: 142)"
  },

  // 16. Biochemistry
  {
    sno: 43,
    department: "Biochemistry",
    doctor_name: "Dr. Rachna Sabharwal",
    specialty: "Biochemistry",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "STAT Cardiac Troponin-I, Arterial Blood Gases (ABG) & Lactate",
    contact_phone: "+91-191-2584290 (Ext: 143)"
  },
  {
    sno: 44,
    department: "Biochemistry",
    doctor_name: "Dr. Ashima Badyal",
    specialty: "Biochemistry",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Critical Electrolytes, Acute Renal Failure & DKA Profiling",
    contact_phone: "+91-191-2584290 (Ext: 144)"
  },
  {
    sno: 45,
    department: "Biochemistry",
    doctor_name: "Dr. Anil Kumar",
    specialty: "Biochemistry",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight STAT Critical Toxicology & Serum Osmolality Desk",
    contact_phone: "+91-191-2584290 (Ext: 145)"
  },

  // 17. Blood Transfusion Medicine
  {
    sno: 46,
    department: "Blood Transfusion Medicine",
    doctor_name: "Dr. Meena Sidhu",
    specialty: "Transfusion Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Massive Transfusion Protocol (MTP) Lead & STAT O- Dispense",
    contact_phone: "+91-191-2584290 (Ext: 146)"
  },
  {
    sno: 47,
    department: "Blood Transfusion Medicine",
    doctor_name: "Dr. Vijay Sawhney",
    specialty: "Transfusion Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Crossmatching, Platelet Apheresis & FFP Allocation",
    contact_phone: "+91-191-2584290 (Ext: 147)"
  },
  {
    sno: 48,
    department: "Blood Transfusion Medicine",
    doctor_name: "Dr. Naveen Akhtar",
    specialty: "Transfusion Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Emergency Blood Bank Dispatch & Cryoprecipitate Supply",
    contact_phone: "+91-191-2584290 (Ext: 148)"
  },

  // 18. Physiology
  {
    sno: 49,
    department: "Physiology",
    doctor_name: "Dr. Vanita Sharma",
    specialty: "Physiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Cardiopulmonary Stress Diagnostics & Acute Hypoxia Evaluation",
    contact_phone: "+91-191-2584290 (Ext: 149)"
  },
  {
    sno: 50,
    department: "Physiology",
    doctor_name: "Dr. Gurmeet Kour",
    specialty: "Physiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Neuro-Electrophysiological Monitoring & Critical Care EEG Standby",
    contact_phone: "+91-191-2584290 (Ext: 150)"
  },
  {
    sno: 51,
    department: "Physiology",
    doctor_name: "Dr. Monica Manhas",
    specialty: "Physiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Critical Care Physiological Telemetry Monitoring",
    contact_phone: "+91-191-2584290 (Ext: 151)"
  }
];

async function seedGMCSpecialists() {
  console.log("=================================================================");
  console.log("  Seeding GMC Jammu with 51 Specialist Doctors & 24/7 Duty Roster ");
  console.log("=================================================================\n");

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Add department column if not exists and drop single-specialty constraint
    console.log("1. Ensuring 'department' column exists and dropping single-specialty constraint in hospital_specialists...");
    await client.query(`
      ALTER TABLE hospital_specialists
      ADD COLUMN IF NOT EXISTS department VARCHAR(100);

      ALTER TABLE hospital_specialists
      DROP CONSTRAINT IF EXISTS hospital_specialists_hospital_id_specialty_key;
    `);

    // 2. Locate GMC Jammu
    const gmcRes = await client.query(`
      SELECT id, name FROM hospitals
      WHERE name ILIKE '%Government Medical College%' OR name ILIKE '%GMC Jammu%'
      LIMIT 1
    `);

    if (!gmcRes.rowCount) {
      throw new Error("GMC Jammu hospital record not found in database.");
    }

    const gmcHospitalId = gmcRes.rows[0].id;
    console.log(`2. Located GMC Jammu (Hospital #${gmcHospitalId}: ${gmcRes.rows[0].name})`);

    // 3. Clear older placeholder GMC specialists before inserting complete 51-faculty roster
    console.log("3. Removing old placeholder specialists for GMC Jammu...");
    await client.query(`DELETE FROM hospital_specialists WHERE hospital_id = $1`, [gmcHospitalId]);

    // Also preserve emergency Trauma Surgery and Pulmonology if needed, or add them as complementary
    const supplementalEmergencySpecialists = [
      {
        department: "Trauma Surgery",
        doctor_name: "Dr. Arvind Sharma, MS (Trauma)",
        specialty: "Trauma Surgery",
        shift: "Morning (08:00 - 16:00)",
        on_duty: true,
        duty_notes: "Chief of Trauma Bay & Severe Hemorrhage Surgical Team",
        contact_phone: "+91-191-2584290 (Ext: 100)"
      },
      {
        department: "Pulmonology",
        doctor_name: "Dr. Sunil Bhat, MD (Chest)",
        specialty: "Pulmonology",
        shift: "Morning (08:00 - 16:00)",
        on_duty: true,
        duty_notes: "Acute Respiratory Distress & Bronchoscopy Emergency Team",
        contact_phone: "+91-191-2584290 (Ext: 152)"
      }
    ];

    const allSpecialists = [...DOCTORS_DATA, ...supplementalEmergencySpecialists];

    console.log(`4. Inserting ${allSpecialists.length} emergency doctors with rotational shift rosters...`);

    let insertedCount = 0;
    for (const doc of allSpecialists) {
      await client.query(`
        INSERT INTO hospital_specialists
          (hospital_id, department, specialty, doctor_name, shift, on_duty, count_available, available, duty_notes, contact_phone, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        gmcHospitalId,
        doc.department,
        doc.specialty,
        doc.doctor_name,
        doc.shift,
        doc.on_duty,
        1,
        doc.on_duty,
        doc.duty_notes,
        doc.contact_phone
      ]);
      insertedCount++;
    }

    await client.query("COMMIT");
    console.log(`\n✅ Successfully added ${insertedCount} faculty doctors to GMC Jammu!`);

    // Verification Query
    const verifyRes = await db.query(`
      SELECT department, COUNT(*) as doc_count,
             COUNT(*) FILTER (WHERE on_duty = true) as on_duty_count
      FROM hospital_specialists
      WHERE hospital_id = $1
      GROUP BY department
      ORDER BY department ASC
    `, [gmcHospitalId]);

    console.log("\n--- GMC Jammu Emergency Department Roster Summary ---");
    console.table(verifyRes.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.pool.end();
  }
}

seedGMCSpecialists();
