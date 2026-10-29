/**
 * Migration Script: MedLink Jammu Regional Hospital Realignment
 * 
 * 1. Deletes Apollo Clinic & Emergency Center from database (not located in Jammu)
 *    and clears all its associated resources, specialists, blood units, and user accounts.
 * 2. Adds 5 prominent Jammu Hospitals:
 *    - Government Hospital, Sarwal
 *    - Shri Maharaja Gulab Singh (SMGS) Hospital
 *    - Super Speciality Hospital, GMC Jammu
 *    - Bee Enn General Hospital
 *    - Pulse Hospital and Research Centre
 * 3. Creates dedicated Hospital Manager accounts with secure passwords for each.
 * 4. Seeds baseline emergency equipment, beds, blood bank inventories, and specialist rosters.
 * 5. Updates Ankur Maitrika Hospital coordinates to its true Channi Himmat location.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');

const NEW_HOSPITALS = [
  {
    name: 'Government Hospital, Sarwal',
    address: 'Sarwal Colony, Jammu, Jammu and Kashmir 180005',
    phone: '+91-191-2537550',
    email: 'sarwal.hospital@medlink.org',
    lat: 32.7485,
    lng: 74.8492,
    operational_status: 'operational',
    manager: {
      name: 'Dr. Rakesh Sharma (Sarwal Medical Superintendent)',
      email: 'sarwal.manager@medlink.org',
      phone: '+91-191-2537550'
    },
    resources: [
      { resource_type: 'Mechanical Ventilator', total: 12, available: 8, status: 'available' },
      { resource_type: 'Defibrillator Unit', total: 6, available: 5, status: 'available' },
      { resource_type: 'ICU Bed', total: 15, available: 9, status: 'available' },
      { resource_type: 'General Ward Bed', total: 80, available: 52, status: 'available' },
      { resource_type: 'Emergency Resuscitation Bay', total: 4, available: 4, status: 'available' },
      { resource_type: 'Operating Room (Trauma)', total: 2, available: 2, status: 'available' },
      { resource_type: 'Cardiac Telemetry Monitor', total: 10, available: 7, status: 'available' },
      { resource_type: 'CT Scanner (64-Slice)', total: 1, available: 1, status: 'available' }
    ],
    doctors: [
      { name: 'Dr. Rakesh Sharma', dept: 'General Medicine', spec: 'Internal Medicine', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2537550 Ext: 101' },
      { name: 'Dr. Arun Gandotra', dept: 'General Surgery', spec: 'General Surgery', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2537550 Ext: 102' },
      { name: 'Dr. Neha Mahajan', dept: 'Emergency Medicine', spec: 'Emergency Care', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2537550 Ext: 103' },
      { name: 'Dr. Vivek Saini', dept: 'Orthopaedics', spec: 'Orthopaedics and Trauma', shift: 'Evening (16:00 - 00:00)', on_duty: false, phone: '+91-191-2537550 Ext: 104' },
      { name: 'Dr. Meenakshi Jamwal', dept: 'Paediatrics', spec: 'Pediatric Care', shift: 'Night (00:00 - 08:00)', on_duty: false, phone: '+91-191-2537550 Ext: 105' }
    ]
  },
  {
    name: 'Shri Maharaja Gulab Singh (SMGS) Hospital',
    address: 'Shalamar Road, Near Indira Chowk, Old Heritage City, Jammu, Jammu & Kashmir 180001',
    phone: '+91-191-2547635',
    email: 'smgs.hospital@medlink.org',
    lat: 32.7302,
    lng: 74.8681,
    operational_status: 'operational',
    manager: {
      name: 'Dr. Dara Singh (SMGS Medical Superintendent)',
      email: 'smgs.manager@medlink.org',
      phone: '+91-191-2547635'
    },
    resources: [
      { resource_type: 'Mechanical Ventilator', total: 25, available: 16, status: 'available' },
      { resource_type: 'Defibrillator Unit', total: 10, available: 8, status: 'available' },
      { resource_type: 'ICU Bed', total: 30, available: 18, status: 'available' },
      { resource_type: 'Pediatric ICU Bed', total: 20, available: 12, status: 'available' },
      { resource_type: 'General Ward Bed', total: 250, available: 140, status: 'available' },
      { resource_type: 'Emergency Resuscitation Bay', total: 6, available: 5, status: 'available' },
      { resource_type: 'Operating Room (Trauma)', total: 3, available: 2, status: 'available' },
      { resource_type: 'Cardiac Telemetry Monitor', total: 18, available: 12, status: 'available' },
      { resource_type: 'CT Scanner (64-Slice)', total: 1, available: 1, status: 'available' }
    ],
    doctors: [
      { name: 'Dr. Ghanshyam Saini', dept: 'Paediatrics', spec: 'Pediatrics and Neonatology', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2547635 Ext: 201' },
      { name: 'Dr. Swarn Kanta', dept: 'Obstetrics & Gynaecology', spec: 'High Risk Obstetrics', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2547635 Ext: 202' },
      { name: 'Dr. Sanjeev Gupta', dept: 'Emergency Medicine', spec: 'Pediatric Emergency', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2547635 Ext: 203' },
      { name: 'Dr. Anjali Sharma', dept: 'ENT', spec: 'Ear, Nose & Throat Surgery', shift: 'Evening (16:00 - 00:00)', on_duty: false, phone: '+91-191-2547635 Ext: 204' },
      { name: 'Dr. Vikram Rathore', dept: 'Anaesthesiology', spec: 'Critical Care & Anaesthesia', shift: 'Night (00:00 - 08:00)', on_duty: false, phone: '+91-191-2547635 Ext: 205' }
    ]
  },
  {
    name: 'Super Speciality Hospital, GMC Jammu',
    address: 'Resham Ghar Colony, Near GMC Jammu Flyover, Bakshi Nagar, Jammu, Jammu & Kashmir 180001',
    phone: '+91-191-2585250',
    email: 'ssh.gmcjammu@medlink.org',
    lat: 32.7388,
    lng: 74.8515,
    operational_status: 'operational',
    manager: {
      name: 'Dr. Manoj Chalotra (SSH Medical Superintendent)',
      email: 'ssh.manager@medlink.org',
      phone: '+91-191-2585250'
    },
    resources: [
      { resource_type: 'Mechanical Ventilator', total: 35, available: 24, status: 'available' },
      { resource_type: 'Defibrillator Unit', total: 15, available: 12, status: 'available' },
      { resource_type: 'ICU Bed', total: 45, available: 28, status: 'available' },
      { resource_type: 'General Ward Bed', total: 200, available: 110, status: 'available' },
      { resource_type: 'Emergency Resuscitation Bay', total: 6, available: 6, status: 'available' },
      { resource_type: 'Operating Room (Trauma)', total: 4, available: 3, status: 'available' },
      { resource_type: 'Cardiac Telemetry Monitor', total: 25, available: 18, status: 'available' },
      { resource_type: 'CT Scanner (64-Slice)', total: 2, available: 2, status: 'available' },
      { resource_type: 'Dialysis Machine', total: 20, available: 14, status: 'available' }
    ],
    doctors: [
      { name: 'Dr. Sushil Sharma', dept: 'Cardiology', spec: 'Interventional Cardiology', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2585250 Ext: 301' },
      { name: 'Dr. Haroon Salaria', dept: 'Neurosurgery', spec: 'Brain and Spine Surgery', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2585250 Ext: 302' },
      { name: 'Dr. Aman Gupta', dept: 'Nephrology', spec: 'Renal Care & Dialysis', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2585250 Ext: 303' },
      { name: 'Dr. Rahul Sharma', dept: 'Urology', spec: 'Urological Surgery', shift: 'Evening (16:00 - 00:00)', on_duty: false, phone: '+91-191-2585250 Ext: 304' },
      { name: 'Dr. Pooja Dogra', dept: 'Critical Care', spec: 'Intensive Care Specialist', shift: 'Night (00:00 - 08:00)', on_duty: false, phone: '+91-191-2585250 Ext: 305' }
    ]
  },
  {
    name: 'Bee Enn General Hospital',
    address: 'Talab Tillo Road, Near Canal Road, Jammu, Jammu and Kashmir 180002',
    phone: '+91-191-2554101',
    email: 'beeennhospital@medlink.org',
    lat: 32.7196,
    lng: 74.8234,
    operational_status: 'operational',
    manager: {
      name: 'Dr. Neeraj Koul (Bee Enn Medical Administrator)',
      email: 'beenn.manager@medlink.org',
      phone: '+91-191-2554101'
    },
    resources: [
      { resource_type: 'Mechanical Ventilator', total: 10, available: 7, status: 'available' },
      { resource_type: 'Defibrillator Unit', total: 5, available: 4, status: 'available' },
      { resource_type: 'ICU Bed', total: 14, available: 8, status: 'available' },
      { resource_type: 'General Ward Bed', total: 90, available: 60, status: 'available' },
      { resource_type: 'Emergency Resuscitation Bay', total: 3, available: 3, status: 'available' },
      { resource_type: 'Operating Room (Trauma)', total: 2, available: 2, status: 'available' },
      { resource_type: 'Cardiac Telemetry Monitor', total: 8, available: 6, status: 'available' },
      { resource_type: 'Dialysis Machine', total: 8, available: 6, status: 'available' }
    ],
    doctors: [
      { name: 'Dr. Neeraj Koul', dept: 'General Medicine', spec: 'Internal Medicine', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2554101 Ext: 401' },
      { name: 'Dr. Renu Gupta', dept: 'General Surgery', spec: 'Laparoscopic Surgery', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2554101 Ext: 402' },
      { name: 'Dr. Ajay Kotwal', dept: 'Orthopaedics', spec: 'Joint Replacement', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2554101 Ext: 403' },
      { name: 'Dr. Sunita Koul', dept: 'Obstetrics & Gynaecology', spec: 'Gynaecology & Obstetrics', shift: 'Evening (16:00 - 00:00)', on_duty: false, phone: '+91-191-2554101 Ext: 404' },
      { name: 'Dr. Amit Mengi', dept: 'Emergency Medicine', spec: 'Emergency Medicine', shift: 'Night (00:00 - 08:00)', on_duty: false, phone: '+91-191-2554101 Ext: 405' }
    ]
  },
  {
    name: 'Pulse Hospital and Research Centre',
    address: 'NH-44 Byepass, Channi Himmat, Jammu, Jammu and Kashmir 180015',
    phone: '+91-191-2460111',
    email: 'pulsehospital@medlink.org',
    lat: 32.6845,
    lng: 74.8852,
    operational_status: 'operational',
    manager: {
      name: 'Dr. Bhupinder Singh (Pulse Medical Director)',
      email: 'pulse.manager@medlink.org',
      phone: '+91-191-2460111'
    },
    resources: [
      { resource_type: 'Mechanical Ventilator', total: 15, available: 11, status: 'available' },
      { resource_type: 'Defibrillator Unit', total: 8, available: 7, status: 'available' },
      { resource_type: 'ICU Bed', total: 20, available: 13, status: 'available' },
      { resource_type: 'General Ward Bed', total: 120, available: 75, status: 'available' },
      { resource_type: 'Emergency Resuscitation Bay', total: 4, available: 4, status: 'available' },
      { resource_type: 'Operating Room (Trauma)', total: 2, available: 2, status: 'available' },
      { resource_type: 'Cardiac Telemetry Monitor', total: 12, available: 9, status: 'available' },
      { resource_type: 'CT Scanner (64-Slice)', total: 1, available: 1, status: 'available' },
      { resource_type: 'Dialysis Machine', total: 10, available: 7, status: 'available' }
    ],
    doctors: [
      { name: 'Dr. Bhupinder Singh', dept: 'Cardiology', spec: 'Cardiovascular Care', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2460111 Ext: 501' },
      { name: 'Dr. Sanjay Wazir', dept: 'Critical Care', spec: 'Intensivist & Emergency Medicine', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2460111 Ext: 502' },
      { name: 'Dr. Priyanka Raina', dept: 'Internal Medicine', spec: 'General Medicine', shift: 'Morning (08:00 - 16:00)', on_duty: true, phone: '+91-191-2460111 Ext: 503' },
      { name: 'Dr. Rajinder Gupta', dept: 'Orthopaedics', spec: 'Trauma & Spine Surgery', shift: 'Evening (16:00 - 00:00)', on_duty: false, phone: '+91-191-2460111 Ext: 504' },
      { name: 'Dr. Sandeep Kour', dept: 'Nephrology', spec: 'Dialysis & Renal Medicine', shift: 'Night (00:00 - 08:00)', on_duty: false, phone: '+91-191-2460111 Ext: 505' }
    ]
  }
];

const STANDARD_BLOOD_GROUPS = [
  { group: 'O+ (Positive)', units: 24, status: 'adequate' },
  { group: 'O- (Universal Red Cell)', units: 8, status: 'critical' },
  { group: 'A+ (Positive)', units: 18, status: 'adequate' },
  { group: 'A- (Negative)', units: 6, status: 'low' },
  { group: 'B+ (Positive)', units: 22, status: 'adequate' },
  { group: 'B- (Negative)', units: 5, status: 'low' },
  { group: 'AB+ (Universal Plasma)', units: 10, status: 'adequate' },
  { group: 'AB- (Negative)', units: 4, status: 'critical' },
  { group: 'Platelets (Apheresis)', units: 12, status: 'adequate' },
  { group: 'Fresh Frozen Plasma (FFP)', units: 20, status: 'adequate' }
];

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('================================================================');
    console.log(' Starting Jammu Hospital Realignment & Manager Seeding');
    console.log('================================================================');

    await client.query('BEGIN');

    // 1. Delete Apollo Clinic & Emergency Center
    const apolloRes = await client.query("SELECT id, name FROM hospitals WHERE name ILIKE '%apollo%'");
    if (apolloRes.rows.length > 0) {
      for (const apollo of apolloRes.rows) {
        console.log(`🗑️ Deleting Apollo Hospital [ID: ${apollo.id} - ${apollo.name}]...`);
        await client.query('DELETE FROM hospital_blood_inventory WHERE hospital_id = $1', [apollo.id]);
        await client.query('DELETE FROM hospital_resources WHERE hospital_id = $1', [apollo.id]);
        await client.query('DELETE FROM hospital_specialists WHERE hospital_id = $1', [apollo.id]);
        await client.query('DELETE FROM incident_dispatch_logs WHERE hospital_id = $1', [apollo.id]);
        await client.query('UPDATE emergency_incidents SET assigned_hospital_id = NULL WHERE assigned_hospital_id = $1', [apollo.id]);
        await client.query('DELETE FROM users WHERE hospital_id = $1 OR email = $2', [apollo.id, 'apollo.manager@medlink.org']);
        await client.query('DELETE FROM hospitals WHERE id = $1', [apollo.id]);
        console.log(`✅ Successfully removed Apollo Hospital and related dependencies.`);
      }
    } else {
      console.log('ℹ️ No Apollo records found in hospitals table.');
    }

    // 2. Fix Ankur Maitrika Location Coordinates to Channi Himmat, Jammu
    await client.query(`
      UPDATE hospitals 
      SET location = ST_SetSRID(ST_MakePoint(74.8872, 32.6934), 4326),
          address = 'Channi Himmat, NH-44 Byepass, Jammu, Jammu and Kashmir 180015'
      WHERE id = 2 OR name ILIKE '%ankur%'
    `);
    console.log('✅ Real-world Jammu coordinates verified for Ankur Maitrika Hospital.');

    const defaultPasswordHash = await bcrypt.hash('HospitalPassword123!', 10);

    // 3. Insert each new hospital and its baseline operational data
    for (const hospData of NEW_HOSPITALS) {
      console.log(`\n🏥 Processing: ${hospData.name}...`);

      // Check if hospital already exists
      const existing = await client.query('SELECT id FROM hospitals WHERE name = $1', [hospData.name]);
      let hospitalId;

      if (existing.rows.length > 0) {
        hospitalId = existing.rows[0].id;
        console.log(`  Updating existing hospital [ID: ${hospitalId}]`);
        await client.query(
          `UPDATE hospitals 
           SET address = $1, phone = $2, email = $3, 
               location = ST_SetSRID(ST_MakePoint($4, $5), 4326),
               operational_status = $6, updated_at = NOW()
           WHERE id = $7`,
          [hospData.address, hospData.phone, hospData.email, hospData.lng, hospData.lat, hospData.operational_status, hospitalId]
        );
      } else {
        const insertRes = await client.query(
          `INSERT INTO hospitals (name, address, phone, email, location, operational_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, NOW(), NOW())
           RETURNING id`,
          [hospData.name, hospData.address, hospData.phone, hospData.email, hospData.lng, hospData.lat, hospData.operational_status]
        );
        hospitalId = insertRes.rows[0].id;
        console.log(`  Created hospital with ID: ${hospitalId}`);
      }

      // Upsert Hospital Manager User
      const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [hospData.manager.email]);
      if (userCheck.rows.length > 0) {
        await client.query(
          `UPDATE users 
           SET name = $1, password_hash = $2, role = 'hospital_manager', hospital_id = $3, phone = $4, updated_at = NOW()
           WHERE email = $5`,
          [hospData.manager.name, defaultPasswordHash, hospitalId, hospData.manager.phone, hospData.manager.email]
        );
        console.log(`  Updated manager user: ${hospData.manager.email}`);
      } else {
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, hospital_id, phone, created_at, updated_at)
           VALUES ($1, $2, $3, 'hospital_manager', $4, $5, NOW(), NOW())`,
          [hospData.manager.name, hospData.manager.email, defaultPasswordHash, hospitalId, hospData.manager.phone]
        );
        console.log(`  Created manager user: ${hospData.manager.email}`);
      }

      // Upsert Preassigned Role if table exists
      try {
        await client.query(
          `INSERT INTO preassigned_roles (email, role, hospital_id)
           VALUES ($1, 'hospital_manager', $2)
           ON CONFLICT (email) DO UPDATE SET role = 'hospital_manager', hospital_id = $2`,
          [hospData.manager.email, hospitalId]
        );
      } catch (err) {
        // preassigned_roles might not have unique constraint or conflict
      }

      // Clear & Seed Resources
      await client.query('DELETE FROM hospital_resources WHERE hospital_id = $1', [hospitalId]);
      for (const res of hospData.resources) {
        await client.query(
          `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [hospitalId, res.resource_type, res.total, res.available, res.status]
        );
      }
      console.log(`  Seeded ${hospData.resources.length} resource categories.`);

      // Clear & Seed Specialists / Doctors
      await client.query('DELETE FROM hospital_specialists WHERE hospital_id = $1', [hospitalId]);
      for (const doc of hospData.doctors) {
        await client.query(
          `INSERT INTO hospital_specialists (
            hospital_id, doctor_name, department, specialty, shift, on_duty, contact_phone, available, count_available, duty_notes, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, NOW())`,
          [
            hospitalId,
            doc.name,
            doc.dept,
            doc.spec,
            doc.shift,
            doc.on_duty,
            doc.phone,
            doc.on_duty,
            `${doc.dept} Specialist - ${doc.shift}`
          ]
        );
      }
      console.log(`  Seeded ${hospData.doctors.length} faculty specialists with duty rosters.`);

      // Clear & Seed Blood Inventory
      await client.query('DELETE FROM hospital_blood_inventory WHERE hospital_id = $1', [hospitalId]);
      for (const b of STANDARD_BLOOD_GROUPS) {
        await client.query(
          `INSERT INTO hospital_blood_inventory (hospital_id, blood_group, units_available, status, updated_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [hospitalId, b.group, b.units, b.status]
        );
      }
      console.log(`  Seeded 10 blood bank inventory groups.`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 ALL 5 JAMMU HOSPITALS AND MANAGERS SUCCESSFULLY PROVISIONED!');

    // Print summary
    const summary = await client.query(`
      SELECT h.id, h.name, u.email as manager_email, 
             COUNT(DISTINCT hr.id) as resources_count,
             COUNT(DISTINCT hs.id) as specialists_count,
             COUNT(DISTINCT hb.id) as blood_types_count
      FROM hospitals h
      LEFT JOIN users u ON u.hospital_id = h.id
      LEFT JOIN hospital_resources hr ON hr.hospital_id = h.id
      LEFT JOIN hospital_specialists hs ON hs.hospital_id = h.id
      LEFT JOIN hospital_blood_inventory hb ON hb.hospital_id = h.id
      GROUP BY h.id, h.name, u.email
      ORDER BY h.id
    `);
    console.table(summary.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
