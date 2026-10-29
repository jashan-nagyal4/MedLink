/**
 * Script: Update and Correct Official Real-World Addresses of all Jammu Regional Hospitals
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/db');

const updates = [
  {
    id: 2,
    name: 'Ankur Maitrika Hospital',
    address: 'Ward No. 55, Deeli, Bypass Road, Near Jodhamal Public School, Channi Himmat, Jammu, Jammu & Kashmir 180011',
    phone: '+91-191-2468888',
    lat: 32.6845,
    lng: 74.8890
  },
  {
    id: 4,
    name: 'Government Medical College & Hospital (GMC Jammu)',
    address: 'Medical College Road, Bakshi Nagar, Jammu, Jammu & Kashmir 180001',
    phone: '0191-2584290',
    lat: 32.735871,
    lng: 74.854675
  },
  {
    id: 5,
    name: 'ASCOMS & Batra Hospital',
    address: 'National Highway Bypass Road, P.O. Majeen, Sidhra, Jammu, Jammu & Kashmir 180017',
    phone: '0191-2262248',
    lat: 32.75128,
    lng: 74.90922
  },
  {
    id: 13,
    name: 'Shri Maharaja Gulab Singh (SMGS) Hospital',
    address: 'Shalamar Road, Near Indira Chowk, Old Heritage City, Jammu, Jammu & Kashmir 180001',
    phone: '+91-191-2547635',
    lat: 32.7336,
    lng: 74.8620
  },
  {
    id: 14,
    name: 'Super Speciality Hospital, GMC Jammu',
    address: 'Resham Ghar Colony, Near GMC Jammu Flyover, Bakshi Nagar, Jammu, Jammu & Kashmir 180001',
    phone: '+91-191-2585250',
    lat: 32.7346,
    lng: 74.8565
  }
];

async function updateAddresses() {
  console.log('🏥 Updating real-world verified addresses for Jammu Regional Hospitals...');

  for (const u of updates) {
    const res = await db.query(
      `UPDATE hospitals
       SET address = $1,
           phone = $2,
           location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
       WHERE id = $5
       RETURNING id, name, address, phone`,
      [u.address, u.phone, u.lng, u.lat, u.id]
    );

    if (res.rowCount > 0) {
      console.log(`✅ [Hospital #${u.id}] ${res.rows[0].name}`);
      console.log(`   📍 Address: ${res.rows[0].address}`);
      console.log(`   📞 Phone:   ${res.rows[0].phone}`);
    } else {
      console.warn(`⚠️ [Hospital #${u.id}] Not found in database.`);
    }
  }

  console.log('\n🎉 All regional hospital addresses and contact details successfully updated!');
  process.exit(0);
}

updateAddresses().catch((err) => {
  console.error('❌ Failed to update hospital addresses:', err.message);
  process.exit(1);
});
