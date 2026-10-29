/**
 * Sample Data Seeder
 * Populates the database with realistic sample hospitals, ICU beds, and specialists.
 */

require("dotenv").config();
const db = require("../src/config/db");

const sampleHospitals = [
  {
    name: "Government Medical College & Hospital (GMC Jammu)",
    address: "Bakshi Nagar, Jammu, Jammu and Kashmir 180001",
    phone: "0191-2584290",
    email: "emergency@gmcjammu.edu.in",
    latitude: 32.7426,
    longitude: 74.8458,
    status: "operational",
    resources: [
      { type: "ICU beds", total: 40, available: 12, status: "available" },
      { type: "ventilators", total: 25, available: 8, status: "available" },
      { type: "CT scanners", total: 2, available: 2, status: "available" },
      { type: "Operating Room", total: 6, available: 3, status: "available" }
    ],
    specialists: [
      { specialty: "Trauma Surgery", count: 3, available: true },
      { specialty: "Cardiology", count: 2, available: true },
      { specialty: "Neurology", count: 2, available: true },
      { specialty: "Pulmonology", count: 1, available: true }
    ]
  },
  {
    name: "ASCOMS & Batra Hospital",
    address: "National Highway Bypass Road, P.O. Majeen, Sidhra, Jammu, Jammu & Kashmir 180017",
    phone: "0191-2262248",
    email: "info@ascoms.com",
    latitude: 32.7533,
    longitude: 74.9122,
    status: "operational",
    resources: [
      { type: "ICU beds", total: 20, available: 5, status: "available" },
      { type: "ventilators", total: 10, available: 3, status: "available" },
      { type: "defibrillators", total: 4, available: 4, status: "available" }
    ],
    specialists: [
      { specialty: "Cardiology", count: 1, available: true },
      { specialty: "General Surgery", count: 2, available: true },
      { specialty: "Pediatrics", count: 2, available: true }
    ]
  },
  {
    name: "Apollo Clinic & Emergency Center",
    address: "Gandhi Nagar, Jammu, Jammu and Kashmir 180004",
    phone: "0191-2432001",
    email: "emergency@apollojammu.com",
    latitude: 32.7090,
    longitude: 74.8680,
    status: "limited",
    resources: [
      { type: "ICU beds", total: 10, available: 2, status: "limited" },
      { type: "ventilators", total: 4, available: 1, status: "available" }
    ],
    specialists: [
      { specialty: "Cardiology", count: 1, available: true },
      { specialty: "Orthopedics", count: 1, available: true }
    ]
  }
];

async function seed() {
  const client = await db.pool.connect();
  try {
    console.log("Seeding sample hospital data...");
    await client.query("BEGIN");

    for (const hosp of sampleHospitals) {
      const hospRes = await client.query(
        `INSERT INTO hospitals (name, address, phone, email, location, operational_status)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
         RETURNING id, name`,
        [hosp.name, hosp.address, hosp.phone, hosp.email, hosp.longitude, hosp.latitude, hosp.status]
      );
      const hospitalId = hospRes.rows[0].id;

      for (const res of hosp.resources) {
        await client.query(
          `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (hospital_id, resource_type) DO NOTHING`,
          [hospitalId, res.type, res.total, res.available, res.status]
        );
      }

      for (const spec of hosp.specialists) {
        await client.query(
          `INSERT INTO hospital_specialists (hospital_id, specialty, available, count_available)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hospital_id, specialty) DO NOTHING`,
          [hospitalId, spec.specialty, spec.available, spec.count]
        );
      }
      console.log(` Added hospital: ${hosp.name}`);
    }

    await client.query("COMMIT");
    console.log(" Seeding completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding error:", err.message);
  } finally {
    client.release();
    await db.pool.end();
  }
}

seed();
