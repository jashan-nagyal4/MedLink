/**
 * Migration Script: Seed Ankur Maitrika Hospital Equipment, Beds & 23 Specialist Doctors Roster
 * 
 * 1. Seeds all 15 Estimated Equipment & Bed Categories for Ankur Maitrika (hospital_id = 2)
 * 2. Seeds all 23 Faculty Doctors across their departments with a 24/7 Rotational Emergency Duty Roster.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

const ANKUR_HOSPITAL_ID = 2;

// 1. Ankur Maitrika Equipment & Bed Estimates (15 Categories)
const ANKUR_RESOURCES = [
  {
    resource_type: "Defibrillator Unit",
    total_quantity: 4,
    available_quantity: 3,
    status: "available",
    notes: "Estimated 2–4 units; emergency defibrillator units with external pacing"
  },
  {
    resource_type: "Mechanical Ventilator",
    total_quantity: 10,
    available_quantity: 6,
    status: "available",
    notes: "Estimated 5–10 units; invasive mechanical ventilators in ICU"
  },
  {
    resource_type: "Defibrillator",
    total_quantity: 4,
    available_quantity: 3,
    status: "available",
    notes: "Estimated 2–4 units; portable crash-cart defibrillators"
  },
  {
    resource_type: "Ventilator",
    total_quantity: 10,
    available_quantity: 7,
    status: "available",
    notes: "Estimated 5–10 units; total ventilatory support inventory"
  },
  {
    resource_type: "ICU Bed",
    total_quantity: 10,
    available_quantity: 5,
    status: "available",
    notes: "Estimated 6–10 ICU beds; dedicated critical care monitoring"
  },
  {
    resource_type: "General Ward Bed",
    total_quantity: 30,
    available_quantity: 18,
    status: "available",
    notes: "Estimated 15–30 in-patient multi-specialty ward beds"
  },
  {
    resource_type: "Pediatric ICU Bed",
    total_quantity: 4,
    available_quantity: 2,
    status: "available",
    notes: "Estimated 0–4 beds; neonatal & pediatric care unit"
  },
  {
    resource_type: "Emergency Resuscitation Bay",
    total_quantity: 2,
    available_quantity: 2,
    status: "available",
    notes: "Estimated 1–2 acute emergency resuscitation triage bays"
  },
  {
    resource_type: "CT Scanner (64-Slice)",
    total_quantity: 1,
    available_quantity: 1,
    status: "available",
    notes: "16-slice diagnostic CT scanner operational on site"
  },
  {
    resource_type: "MRI Scanner (1.5T)",
    total_quantity: 0,
    available_quantity: 0,
    status: "unavailable",
    notes: "Not verified; no current official confirmation on site"
  },
  {
    resource_type: "Operating Room (Trauma)",
    total_quantity: 1,
    available_quantity: 1,
    status: "available",
    notes: "Emergency OT confirmed; surgical trauma intervention"
  },
  {
    resource_type: "Cardiac Telemetry Monitor",
    total_quantity: 10,
    available_quantity: 7,
    status: "available",
    notes: "Estimated 5–10 continuous multi-parameter cardiac telemetry units"
  },
  {
    resource_type: "Dialysis Machine",
    total_quantity: 12,
    available_quantity: 8,
    status: "available",
    notes: "Estimated 8–12 hemodialysis stations in renal unit"
  },
  {
    resource_type: "Burn Unit Bed",
    total_quantity: 0,
    available_quantity: 0,
    status: "unavailable",
    notes: "Not verified; dedicated burn-unit capacity not publicly confirmed"
  },
  {
    resource_type: "Negative Pressure Isolation Room",
    total_quantity: 0,
    available_quantity: 0,
    status: "unavailable",
    notes: "Not verified; no public confirmation found"
  }
];

// 2. Ankur Maitrika 23 Faculty Doctors & 24/7 Duty Roster
const ANKUR_DOCTORS = [
  // 1. Obstetrics & Gynaecology (2)
  {
    sno: 1,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Ajay Wakhloo",
    specialty: "Gynaecology and Obstetrics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "High-Risk Obstetrics, Gynaecological Laparoscopy & Labour Room Chief",
    contact_phone: "+91-191-2470001 (Ext: 101)"
  },
  {
    sno: 11,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Manpreet Kour",
    specialty: "Gynaecology and Obstetrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Labour Room Handover & Acute Foetal Distress On-Call",
    contact_phone: "+91-191-2470001 (Ext: 102)"
  },

  // 2. Nephrology (1)
  {
    sno: 2,
    department: "Nephrology",
    doctor_name: "Dr. Deepak Pathania",
    specialty: "Kidney diseases and Nephrology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Renal Failure, Emergency Hemodialysis & Glomerular Diseases Lead",
    contact_phone: "+91-191-2470001 (Ext: 103)"
  },

  // 3. Critical Care (1)
  {
    sno: 3,
    department: "Critical Care",
    doctor_name: "Dr. Rohit Gupta",
    specialty: "Critical Care and Intensive Care",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Medical & Surgical ICU Chief, Invasive Mechanical Ventilation & Sepsis Lead",
    contact_phone: "+91-191-2470001 (Ext: 104)"
  },

  // 4. Cardiology (1)
  {
    sno: 4,
    department: "Cardiology",
    doctor_name: "Dr. Mehroz Mirza",
    specialty: "Interventional Cardiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute STEMI / Primary Angioplasty Lead & 24/7 Cardiac Emergency Protocol",
    contact_phone: "+91-191-2470001 (Ext: 105)"
  },

  // 5. Neurosurgery (1)
  {
    sno: 5,
    department: "Neurosurgery",
    doctor_name: "Dr. Vipul Kumar Gupta",
    specialty: "Brain and Spine Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Traumatic Brain Injury, Emergency Craniotomy & Spinal Cord Decompression Lead",
    contact_phone: "+91-191-2470001 (Ext: 106)"
  },

  // 6. Orthopaedics (1)
  {
    sno: 6,
    department: "Orthopaedics",
    doctor_name: "Dr. Satvir Singh",
    specialty: "Orthopaedics and Joint Replacement",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Polytrauma, Compound Fracture Reduction & Emergency External Fixation Lead",
    contact_phone: "+91-191-2470001 (Ext: 107)"
  },

  // 7. Urology (1)
  {
    sno: 7,
    department: "Urology",
    doctor_name: "Dr. Anchal Kotwal",
    specialty: "Urinary Tract and Urological Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Obstructive Uropathy, Renal Trauma & Acute Urological Emergencies Lead",
    contact_phone: "+91-191-2470001 (Ext: 108)"
  },

  // 8. Surgical Oncology (1)
  {
    sno: 8,
    department: "Surgical Oncology",
    doctor_name: "Dr. Sandeep Bhat",
    specialty: "Gastrointestinal Cancer Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Surgical Oncology, GI Cancer Resection & Complex Abdominal Surgery Lead",
    contact_phone: "+91-191-2470001 (Ext: 109)"
  },

  // 9. Gastroenterology (2)
  {
    sno: 9,
    department: "Gastroenterology",
    doctor_name: "Dr. Rahul Sudan",
    specialty: "Gastroenterology and Hepatology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Upper GI Bleeding, Cirrhosis & Emergency Therapeutic Endoscopy Lead",
    contact_phone: "+91-191-2470001 (Ext: 110)"
  },
  {
    sno: 13,
    department: "Gastroenterology",
    doctor_name: "Dr. Suresh Gorkha",
    specialty: "Gastroenterology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Pancreatitis, Biliary Obstruction & Emergency Endoscopy Handover",
    contact_phone: "+91-191-2470001 (Ext: 111)"
  },

  // 10. Vascular Surgery (1)
  {
    sno: 10,
    department: "Vascular Surgery",
    doctor_name: "Dr. Bhumika Gupta",
    specialty: "Vascular Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Arterial Embolism, Vascular Trauma & Emergency Revascularization Lead",
    contact_phone: "+91-191-2470001 (Ext: 112)"
  },

  // 11. Internal Medicine (1)
  {
    sno: 12,
    department: "Internal Medicine",
    doctor_name: "Dr. Akshay Pachyala",
    specialty: "General Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Medical Admissions, Septic Shock & Multi-system Disease Management Lead",
    contact_phone: "+91-191-2470001 (Ext: 113)"
  },

  // 12. Physiotherapy and Dietetics (1)
  {
    sno: 14,
    department: "Physiotherapy and Dietetics",
    doctor_name: "Dr. Sahiba Gupta",
    specialty: "Physiotherapy, Dietetics and Nutrition",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Inpatient Chest Physiotherapy, Critical Care Mobilization & Clinical Nutrition",
    contact_phone: "+91-191-2470001 (Ext: 114)"
  },

  // 13. Paediatrics and Neonatology (2)
  {
    sno: 15,
    department: "Paediatrics and Neonatology",
    doctor_name: "Dr. Anuj Bhatti",
    specialty: "Children's and Newborn Care",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Neonatal Resuscitation, Extreme Prematurity & Pediatric Critical Care Lead",
    contact_phone: "+91-191-2470001 (Ext: 115)"
  },
  {
    sno: 22,
    department: "Paediatrics",
    doctor_name: "Dr. Shaurya Partap",
    specialty: "Paediatrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Pediatric Emergency Admissions & Acute Respiratory Infections On-Call",
    contact_phone: "+91-191-2470001 (Ext: 116)"
  },

  // 14. General Surgery (1)
  {
    sno: 16,
    department: "General Surgery",
    doctor_name: "Dr. Javed Banday",
    specialty: "General and Laparoscopic Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Abdominal Surgery, Peritonitis & Laparoscopic Interventions Lead",
    contact_phone: "+91-191-2470001 (Ext: 117)"
  },

  // 15. ENT (1)
  {
    sno: 17,
    department: "ENT",
    doctor_name: "Dr. Mohit Goel",
    specialty: "Ear, Nose and Throat",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Airway Stridor, Severe Epistaxis & Foreign Body Removal Lead",
    contact_phone: "+91-191-2470001 (Ext: 118)"
  },

  // 16. Dentistry (1)
  {
    sno: 18,
    department: "Dentistry",
    doctor_name: "Dr. Ginnie Pathania",
    specialty: "Prosthodontics and Dental Rehabilitation",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Dental Trauma, Odontogenic Abscess & Maxillofacial Rehabilitation Lead",
    contact_phone: "+91-191-2470001 (Ext: 119)"
  },

  // 17. Radiology (1)
  {
    sno: 19,
    department: "Radiology",
    doctor_name: "Dr. Aamir Javed",
    specialty: "Medical Imaging and Radiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency CT Scans, Trauma FAST Ultrasound & Interventional Imaging Lead",
    contact_phone: "+91-191-2470001 (Ext: 120)"
  },

  // 18. Plastic Surgery (1)
  {
    sno: 20,
    department: "Plastic Surgery",
    doctor_name: "Dr. Jharna Verma",
    specialty: "Plastic and Reconstructive Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Soft Tissue Trauma, Tendon Repair & Emergency Microvascular Reconstruction Lead",
    contact_phone: "+91-191-2470001 (Ext: 121)"
  },

  // 19. Emergency Medicine (1)
  {
    sno: 21,
    department: "Emergency Medicine",
    doctor_name: "Dr. Vernpall Singh",
    specialty: "Emergency Care",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Department Lead, Level-1 Triage & Polytrauma Resuscitation Chief",
    contact_phone: "+91-191-2470001 (Ext: 122)"
  },

  // 20. General Medicine / Consulting (1)
  {
    sno: 23,
    department: "General Medicine",
    doctor_name: "Dr. Dhruv Gupta",
    specialty: "Consultant Physician / Clinical Services",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Clinical Services & General Medical Inpatient On-Call",
    contact_phone: "+91-191-2470001 (Ext: 123)"
  }
];

async function migrate() {
  console.log("=========================================================");
  console.log(" MedLink: Migrating Ankur Maitrika Equipment, Beds & 23 Doctors");
  console.log("=========================================================\n");

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify Ankur Maitrika Hospital Existence
    const hospRes = await client.query(
      `SELECT id, name FROM hospitals WHERE id = $1`,
      [ANKUR_HOSPITAL_ID]
    );
    if (!hospRes.rowCount) {
      throw new Error(`Hospital ID ${ANKUR_HOSPITAL_ID} (Ankur Maitrika) not found in database.`);
    }
    console.log(`Found target hospital: [ID: ${hospRes.rows[0].id}] ${hospRes.rows[0].name}`);

    // 2. Clear old resources and specialists for Ankur Maitrika
    await client.query(`DELETE FROM hospital_resources WHERE hospital_id = $1`, [ANKUR_HOSPITAL_ID]);
    await client.query(`DELETE FROM hospital_specialists WHERE hospital_id = $1`, [ANKUR_HOSPITAL_ID]);
    console.log("Cleared previous resources and specialists for Ankur Maitrika.");

    // 3. Insert all 15 Equipment & Bed Categories
    console.log(`\n1. Seeding ${ANKUR_RESOURCES.length} equipment and bed categories for Ankur Maitrika...`);
    for (const res of ANKUR_RESOURCES) {
      await client.query(
        `INSERT INTO hospital_resources
          (hospital_id, resource_type, total_quantity, available_quantity, status, notes, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          ANKUR_HOSPITAL_ID,
          res.resource_type,
          res.total_quantity,
          res.available_quantity,
          res.status,
          res.notes
        ]
      );
    }
    console.log(`✅ Successfully inserted all ${ANKUR_RESOURCES.length} equipment & bed capacities.`);

    // 4. Insert all 23 Specialist Doctors across 19 Departments
    console.log(`\n2. Seeding all ${ANKUR_DOCTORS.length} faculty doctors with 24/7 rotational duty roster...`);
    for (const doc of ANKUR_DOCTORS) {
      await client.query(
        `INSERT INTO hospital_specialists
          (hospital_id, doctor_name, department, specialty, shift, on_duty, available, count_available, duty_notes, contact_phone, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          ANKUR_HOSPITAL_ID,
          doc.doctor_name,
          doc.department,
          doc.specialty,
          doc.shift,
          doc.on_duty,
          doc.on_duty, // available matches on_duty
          doc.on_duty ? 1 : 0,
          doc.duty_notes,
          doc.contact_phone
        ]
      );
    }
    console.log(`✅ Successfully seeded all ${ANKUR_DOCTORS.length} faculty doctors.`);

    await client.query("COMMIT");

    // 5. Query and output validation summary
    const resSummary = await db.query(
      `SELECT resource_type, total_quantity, available_quantity, status FROM hospital_resources WHERE hospital_id = $1 ORDER BY id`,
      [ANKUR_HOSPITAL_ID]
    );
    console.log("\n--- Ankur Maitrika Equipment & Bed Summary ---");
    console.table(resSummary.rows);

    const docSummary = await db.query(
      `SELECT department, COUNT(*) as total_doctors, SUM(CASE WHEN on_duty THEN 1 ELSE 0 END) as on_duty_doctors
       FROM hospital_specialists
       WHERE hospital_id = $1
       GROUP BY department
       ORDER BY department`,
      [ANKUR_HOSPITAL_ID]
    );
    console.log("\n--- Ankur Maitrika Faculty Doctors by Department & On-Duty Status ---");
    console.table(docSummary.rows);

    const totalStats = await db.query(
      `SELECT COUNT(*) as total_doctors, SUM(CASE WHEN on_duty THEN 1 ELSE 0 END) as on_duty_count
       FROM hospital_specialists
       WHERE hospital_id = $1`,
      [ANKUR_HOSPITAL_ID]
    );
    console.log("Overall Ankur Maitrika Roster:", totalStats.rows[0]);

    console.log("\n🎉 Ankur Maitrika Hospital migration completed successfully!");
    process.exit(0);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed with error:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
