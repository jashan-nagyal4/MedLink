const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../src/config/db');

async function seedSampleIncidents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Patient 1
    const p1 = await client.query(`
      INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
      VALUES ('Sunil Dogra', 54, 'male', '+91-9419123456', 'Hypertension, Prior Angioplasty', 'Penicillin')
      RETURNING id
    `);
    
    // Patient 2
    const p2 = await client.query(`
      INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
      VALUES ('Aarav Sharma', 6, 'male', '+91-9419188888', 'Asthma', 'None')
      RETURNING id
    `);

    // Patient 3
    const p3 = await client.query(`
      INSERT INTO patients (name, age, gender, contact_number, medical_history, allergies)
      VALUES ('Kavita Verma', 32, 'female', '+91-9419177777', 'None', 'NSAIDs')
      RETURNING id
    `);

    // Incident 1: Acute Chest Pain
    await client.query(`
      INSERT INTO emergency_incidents 
      (incident_number, caller_name, caller_phone, patient_id, location, address, severity, triage_level, chief_complaint, condition_category, status, assigned_hospital_id, notes, created_at, updated_at)
      VALUES 
      ('INC-20261027-001', 'Ramesh Dogra', '+91-9419123456', $1, ST_SetSRID(ST_MakePoint(74.8620, 32.7120), 4326)::geography, 'Apsara Road, Gandhi Nagar, Jammu', 'critical', 'resuscitation', 'Severe crushing retrosternal chest pain radiating to left arm', 'cardiac', 'assigned', 4, 'Patient conscious, diaphoresis present. GMC Cardiology alerted.', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes')
    `, [p1.rows[0].id]);

    // Incident 2: Pediatric Asthma / Respiratory Failure
    await client.query(`
      INSERT INTO emergency_incidents 
      (incident_number, caller_name, caller_phone, patient_id, location, address, severity, triage_level, chief_complaint, condition_category, status, assigned_hospital_id, notes, created_at, updated_at)
      VALUES 
      ('INC-20261027-002', 'Pooja Sharma', '+91-9419188888', $1, ST_SetSRID(ST_MakePoint(74.8670, 32.7290), 4326)::geography, 'Old Heritage Market, Shalamar, Jammu', 'critical', 'resuscitation', 'Acute respiratory distress, severe stridor and wheezing', 'pediatric', 'assigned', 13, 'SMGS Pediatric Emergency team on standby. High-flow oxygen initiated.', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '15 minutes')
    `, [p2.rows[0].id]);

    // Incident 3: High-speed road accident
    await client.query(`
      INSERT INTO emergency_incidents 
      (incident_number, caller_name, caller_phone, patient_id, location, address, severity, triage_level, chief_complaint, condition_category, status, assigned_hospital_id, notes, created_at, updated_at)
      VALUES 
      ('INC-20261027-003', 'Traffic Police Jammu Control', '+91-191-2459999', $1, ST_SetSRID(ST_MakePoint(74.8860, 32.6860), 4326)::geography, 'NH-44 Byepass Junction, Channi Himmat, Jammu', 'critical', 'emergency', 'Motor vehicle rollover collision, polytrauma with blunt thoracic trauma', 'trauma', 'assigned', 16, 'Pulse Hospital trauma resuscitation bay pre-alerted.', NOW() - INTERVAL '10 minutes', NOW())
    `, [p3.rows[0].id]);

    await client.query('COMMIT');
    console.log('✅ Seeded 3 sample emergency incidents with full audit fields.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding sample incidents:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedSampleIncidents();
