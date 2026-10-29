/**
 * Seed Script: Provision Ankur Maitrika & Apollo Login Access & Hospital Roster
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const db = require("../src/config/db");

async function seedAccess() {
  console.log("=========================================================");
  console.log(" MedLink: Provisioning Ankur Maitrika & Apollo Login Access");
  console.log("=========================================================\n");

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash("HospitalPassword123!", saltRounds);

  // 1. Ensure Ankur Maitrika (id: 2) Manager user exists
  await db.query(
    `INSERT INTO users (name, email, password_hash, role, hospital_id, phone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         hospital_id = EXCLUDED.hospital_id,
         phone = EXCLUDED.phone,
         updated_at = NOW()`,
    [
      "Dr. Rohini Mehta (Ankur Maitrika Triage Lead)",
      "ankur.manager@medlink.org",
      passwordHash,
      "hospital_manager",
      2,
      "+91-9110000005"
    ]
  );
  console.log("✅ Ankur Maitrika Manager provisioned: ankur.manager@medlink.org / HospitalPassword123! (Hospital #2)");

  // 2. Ensure Apollo (id: 6) Manager user exists and has working password
  await db.query(
    `INSERT INTO users (name, email, password_hash, role, hospital_id, phone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         hospital_id = EXCLUDED.hospital_id,
         phone = EXCLUDED.phone,
         updated_at = NOW()`,
    [
      "Dr. Ananya Sen (Apollo Emergency Lead)",
      "apollo.manager@medlink.org",
      passwordHash,
      "hospital_manager",
      6,
      "+91-9110000004"
    ]
  );
  console.log("✅ Apollo Manager provisioned: apollo.manager@medlink.org / HospitalPassword123! (Hospital #6)");

  // 3. Populate starter equipment and beds for Ankur Maitrika if needed
  const ankurResources = [
    { type: "ICU Bed", total: 18, avail: 7, status: "available", notes: "Critical care ICU monitoring beds" },
    { type: "General Ward Bed", total: 120, avail: 68, status: "available", notes: "Multi-specialty patient ward beds" },
    { type: "Emergency Resuscitation Bay", total: 4, avail: 3, status: "available", notes: "Acute emergency admission and triage bays" },
    { type: "Mechanical Ventilator", total: 15, avail: 8, status: "available", notes: "ICU-grade mechanical ventilatory support" },
    { type: "Defibrillator Unit", total: 8, avail: 5, status: "available", notes: "Biphasic defibrillator with external pacing" }
  ];

  for (const r of ankurResources) {
    await db.query(
      `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes, updated_at)
       VALUES (2, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (hospital_id, resource_type) DO UPDATE
       SET total_quantity = EXCLUDED.total_quantity,
           available_quantity = EXCLUDED.available_quantity,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
      [r.type, r.total, r.avail, r.status, r.notes]
    );
  }
  console.log("✅ Ankur Maitrika capacity updated with ICU beds, general beds, and emergency bays.");

  // 4. Populate starter equipment and beds for Apollo if needed
  const apolloResources = [
    { type: "ICU Bed", total: 16, avail: 6, status: "available", notes: "Apollo Emergency critical care beds" },
    { type: "General Ward Bed", total: 100, avail: 54, status: "available", notes: "Inpatient recovery and observation ward" },
    { type: "Emergency Resuscitation Bay", total: 3, avail: 2, status: "available", notes: "Trauma stabilization & triage bays" },
    { type: "Mechanical Ventilator", total: 10, avail: 5, status: "available", notes: "Mechanical invasive ventilation units" },
    { type: "Defibrillator Unit", total: 8, avail: 5, status: "available", notes: "Biphasic defibrillator with external pacing" }
  ];

  for (const r of apolloResources) {
    await db.query(
      `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes, updated_at)
       VALUES (6, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (hospital_id, resource_type) DO UPDATE
       SET total_quantity = EXCLUDED.total_quantity,
           available_quantity = EXCLUDED.available_quantity,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = NOW()`,
      [r.type, r.total, r.avail, r.status, r.notes]
    );
  }
  console.log("✅ Apollo capacity updated with ICU beds, general beds, and emergency bays.");

  // 5. Populate starter specialist roster for Ankur Maitrika (id: 2)
  const ankurDoctors = [
    { name: "Dr. Rohini Mehta", dept: "General Medicine", spec: "Internal Medicine", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Triage Chief & Medical ICU Lead", phone: "+91-191-2470001 (Ext: 101)" },
    { name: "Dr. Sanjay Pandita", dept: "General Medicine", spec: "Internal Medicine", shift: "Evening (16:00 - 00:00)", onDuty: false, notes: "Acute Medical Admissions Handover", phone: "+91-191-2470001 (Ext: 102)" },
    { name: "Dr. Arvind Chib", dept: "General Surgery", spec: "General Surgery", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Emergency Laparotomy & Trauma Lead", phone: "+91-191-2470001 (Ext: 103)" },
    { name: "Dr. Neha Kalsi", dept: "Cardiology", spec: "Cardiology", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Acute Coronary Care & Echo Lead", phone: "+91-191-2470001 (Ext: 104)" },
    { name: "Dr. Manish Mahajan", dept: "Orthopaedics", spec: "Orthopaedics", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Fracture Reduction & Polytrauma Lead", phone: "+91-191-2470001 (Ext: 105)" },
    { name: "Dr. Pooja Raina", dept: "Paediatrics", spec: "Paediatrics", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Neonatal & Paediatric Emergency Lead", phone: "+91-191-2470001 (Ext: 106)" },
    { name: "Dr. Vikas Sharma", dept: "Anaesthesiology", spec: "Anaesthesiology", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Emergency OT & Resuscitation Lead", phone: "+91-191-2470001 (Ext: 107)" }
  ];

  for (const doc of ankurDoctors) {
    await db.query(
      `INSERT INTO hospital_specialists (hospital_id, doctor_name, department, specialty, shift, on_duty, available, count_available, duty_notes, contact_phone, updated_at)
       VALUES (2, $1, $2, $3, $4, $5, $5, $6, $7, $8, NOW())`,
      [doc.name, doc.dept, doc.spec, doc.shift, doc.onDuty, doc.onDuty ? 1 : 0, doc.notes, doc.phone]
    );
  }
  console.log("✅ Ankur Maitrika doctor roster seeded with on-duty faculty.");

  // 6. Populate starter specialist roster for Apollo (id: 6)
  const apolloDoctors = [
    { name: "Dr. Ananya Sen", dept: "Emergency", spec: "Emergency Medicine", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Level-1 Triage & Trauma Resuscitation Lead", phone: "+91-191-2435551 (Ext: 101)" },
    { name: "Dr. Sanjeev Koul", dept: "Cardiology", spec: "Cardiology", shift: "Night (00:00 - 08:00)", onDuty: true, notes: "Interventional Cardiology & STEMI Lead", phone: "+91-191-2435551 (Ext: 102)" },
    { name: "Dr. Raman Gupta", dept: "Orthopaedics", spec: "Orthopaedics", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Acute Fracture Fixation & Joint Trauma", phone: "+91-191-2435551 (Ext: 103)" },
    { name: "Dr. Priya Dhar", dept: "General Medicine", spec: "Internal Medicine", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Critical Medical ICU & Sepsis Protocol", phone: "+91-191-2435551 (Ext: 104)" },
    { name: "Dr. Amitab Bakshi", dept: "General Surgery", spec: "General Surgery", shift: "Evening (16:00 - 00:00)", onDuty: true, notes: "Emergency Surgical On-Call", phone: "+91-191-2435551 (Ext: 105)" },
    { name: "Dr. Sonali Rajput", dept: "Paediatrics", spec: "Paediatrics", shift: "Morning (08:00 - 16:00)", onDuty: true, notes: "Pediatric Emergency Triage Lead", phone: "+91-191-2435551 (Ext: 106)" }
  ];

  await db.query(`DELETE FROM hospital_specialists WHERE hospital_id = 6`);
  for (const doc of apolloDoctors) {
    await db.query(
      `INSERT INTO hospital_specialists (hospital_id, doctor_name, department, specialty, shift, on_duty, available, count_available, duty_notes, contact_phone, updated_at)
       VALUES (6, $1, $2, $3, $4, $5, $5, $6, $7, $8, NOW())`,
      [doc.name, doc.dept, doc.spec, doc.shift, doc.onDuty, doc.onDuty ? 1 : 0, doc.notes, doc.phone]
    );
  }
  console.log("✅ Apollo doctor roster seeded with on-duty faculty.");

  console.log("\n🎉 Database provisioning for Ankur Maitrika & Apollo completed successfully!");
  process.exit(0);
}

seedAccess().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
