const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../src/config/db");

async function deleteSpecifiedHospitals() {
  const client = await db.pool.connect();
  try {
    console.log("🔍 Finding target hospitals to delete...");
    const searchRes = await client.query(`
      SELECT id, name FROM hospitals 
      WHERE LOWER(name) LIKE '%bee enn%' 
         OR LOWER(name) LIKE '%sarwal%' 
         OR LOWER(name) LIKE '%pulse%'
    `);

    if (searchRes.rows.length === 0) {
      console.log("No matching hospitals found to delete.");
      return;
    }

    console.log(`Found ${searchRes.rows.length} hospital(s) to delete:`, searchRes.rows);

    for (const h of searchRes.rows) {
      console.log(`\n⏳ Deleting Hospital #${h.id} (${h.name})...`);
      await client.query("BEGIN");

      // 1. Demote any hospital managers linked to this hospital to patient
      const userUpdateRes = await client.query(
        `UPDATE users SET role = 'patient', hospital_id = NULL, updated_at = NOW() WHERE hospital_id = $1 RETURNING id, name, email`,
        [h.id]
      );
      if (userUpdateRes.rowCount > 0) {
        console.log(`   Demoted ${userUpdateRes.rowCount} user(s) to patient role:`, userUpdateRes.rows.map(u => u.email));
      }

      // 2. Remove preassigned roles
      await client.query(`DELETE FROM preassigned_roles WHERE hospital_id = $1`, [h.id]);

      // 3. Clear references from emergency_incidents
      await client.query(`UPDATE emergency_incidents SET assigned_hospital_id = NULL WHERE assigned_hospital_id = $1`, [h.id]);
      await client.query(`UPDATE emergency_incidents SET referring_hospital_id = NULL WHERE referring_hospital_id = $1`, [h.id]);
      await client.query(`UPDATE emergency_incidents SET current_dispatch_hospital_id = NULL WHERE current_dispatch_hospital_id = $1`, [h.id]);

      // 4. Delete the hospital (cascades to resources, specialists, blood inventory, etc.)
      const delRes = await client.query(`DELETE FROM hospitals WHERE id = $1 RETURNING id, name`, [h.id]);
      await client.query("COMMIT");
      console.log(`   ✅ Hospital #${delRes.rows[0].id} (${delRes.rows[0].name}) successfully deleted.`);
    }

    // Verify remaining hospitals
    const remaining = await client.query(`SELECT id, name FROM hospitals ORDER BY name ASC`);
    console.log(`\n🏥 Remaining Regional Hospitals (${remaining.rowCount}):`);
    remaining.rows.forEach(r => console.log(`   - [#${r.id}] ${r.name}`));

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting hospitals:", err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

deleteSpecifiedHospitals();
