const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../src/config/db");

async function addResolvedStatus() {
  try {
    console.log("Checking and updating emergency_incidents_status_check constraint...");
    await db.query(`
      ALTER TABLE emergency_incidents DROP CONSTRAINT IF EXISTS emergency_incidents_status_check;
      ALTER TABLE emergency_incidents ADD CONSTRAINT emergency_incidents_status_check
        CHECK (status IN (
          'reported', 'assessing', 'dispatching', 'requested', 'accepted',
          'assigned', 'rejected', 'timed_out', 'escalated', 'en_route',
          'arrived', 'resolved', 'closed', 'cancelled', 'exhausted',
          'transfer_requested', 'transferred'
        ));
    `);
    console.log("✅ Successfully added 'resolved' to emergency_incidents status constraint.");
  } catch (err) {
    console.error("❌ Failed to update status constraint:", err.message);
  } finally {
    await db.pool.end();
  }
}

addResolvedStatus();
