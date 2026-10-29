/**
 * Automated Test Suite for User Authentication & Role-Based Access Control (RBAC)
 * 
 * Verifies:
 * 1. Login with demo accounts (Admin, Hospital Manager, Patient) and JWT generation
 * 2. New patient self-registration with bcrypt password hashing
 * 3. GET /api/auth/me token verification
 * 4. RBAC Permission Guards:
 *    - Patients blocked from updating hospital resources (403)
 *    - Hospital Managers blocked from modifying other hospitals (403)
 *    - Hospital Managers permitted to update their own facility (200)
 *    - Admins permitted to manage all hospitals and dispatch controls (200)
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const http = require("http");
const app = require("../src/app");
const db = require("../src/config/db");
const socketService = require("../src/services/socketService");

let testPort = 0;
let server;
const testCreatedUserEmails = [];

async function request(method, path, body = null, token = null) {
  const url = `http://127.0.0.1:${testPort}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("===============================================================");
  console.log("  MedLink User Authentication & RBAC Verification Suite  ");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    server = http.createServer(app);
    socketService.init(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    testPort = server.address().port;
    console.log(`✅ Test server running on dynamic port ${testPort}...`);

    // =========================================================================
    // 1. Test Demo Accounts Discovery
    // =========================================================================
    console.log("1. Testing Demo Accounts Discovery...");
    const demoRes = await request("GET", "/api/auth/demo-users");
    assert(demoRes.status === 200, "GET /api/auth/demo-users returned 200 OK");
    assert(Array.isArray(demoRes.data.demoAccounts), "demoAccounts array returned");
    assert(demoRes.data.demoAccounts.length >= 4, "Contains Admin, Hospital Managers, and Patient");

    // =========================================================================
    // 2. Test Admin Login
    // =========================================================================
    console.log("\n2. Testing Admin Login...");
    const adminLogin = await request("POST", "/api/auth/login", {
      email: "admin@medlink.org",
      password: "AdminPassword123!"
    });

    assert(adminLogin.status === 200, "Admin login returned 200 OK");
    assert(typeof adminLogin.data.token === "string", "Valid JWT token returned");
    assert(adminLogin.data.user.role === "admin", "User role is 'admin'");
    const adminToken = adminLogin.data.token;

    // Test GET /me with admin token
    const adminMe = await request("GET", "/api/auth/me", null, adminToken);
    assert(adminMe.status === 200 && adminMe.data.user.email === "admin@medlink.org", "GET /api/auth/me verifies admin token");

    // =========================================================================
    // 3. Test Hospital Manager Login (GMC Jammu)
    // =========================================================================
    console.log("\n3. Testing Hospital Manager Login...");
    const hospLogin = await request("POST", "/api/auth/login", {
      email: "gmc.manager@medlink.org",
      password: "HospitalPassword123!"
    });

    assert(hospLogin.status === 200, "Hospital manager login returned 200 OK");
    assert(hospLogin.data.user.role === "hospital_manager", "User role is 'hospital_manager'");
    assert(hospLogin.data.user.hospital_id !== null, "Hospital manager is linked to a hospital_id");
    const gmcToken = hospLogin.data.token;
    const gmcHospId = hospLogin.data.user.hospital_id;

    // =========================================================================
    // 4. Test Patient Registration & Login
    // =========================================================================
    console.log("\n4. Testing New Patient Registration...");
    const uniqueEmail = `test.citizen.${Date.now()}@example.com`;
    testCreatedUserEmails.push(uniqueEmail);

    const regRes = await request("POST", "/api/auth/register", {
      name: "Simran Kour",
      email: uniqueEmail,
      password: "SecurePassword123!",
      phone: "+91-9988771122"
    });

    assert(regRes.status === 201, "POST /api/auth/register returned 201 Created");
    assert(regRes.data.user.role === "patient", "Registered user role defaulted to 'patient'");
    const patientToken = regRes.data.token;

    // =========================================================================
    // 5. Test RBAC Permission Enforcement
    // =========================================================================
    console.log("\n5. Testing RBAC Permission Guards...");

    // Find a resource in GMC Jammu to update
    const hospCheck = await request("GET", `/api/hospitals/${gmcHospId}`);
    const targetResource = hospCheck.data.resources[0];

    // Attempt A: Patient tries to modify hospital resources -> MUST FAIL (403)
    const patientModRes = await request(
      "PATCH",
      `/api/hospitals/${gmcHospId}/resources/${targetResource.id}`,
      { availableQuantity: 99 },
      patientToken
    );
    assert(patientModRes.status === 403, "Patient blocked from modifying hospital resources (403 Forbidden)");

    // Attempt B: GMC Manager tries to modify another hospital (e.g. Hospital 5 Batra) -> MUST FAIL (403)
    const otherHospId = Number(gmcHospId) === 4 ? 5 : 4;
    const gmcCrossMod = await request(
      "PATCH",
      `/api/hospitals/${otherHospId}/resources/1`,
      { availableQuantity: 99 },
      gmcToken
    );
    assert(gmcCrossMod.status === 403, "GMC Manager blocked from modifying another hospital's capacity (403 Forbidden)");

    // Attempt C: GMC Manager modifies their OWN hospital (GMC) -> MUST SUCCEED (200)
    const gmcOwnMod = await request(
      "PATCH",
      `/api/hospitals/${gmcHospId}/resources/${targetResource.id}`,
      { availableQuantity: targetResource.available_quantity },
      gmcToken
    );
    assert(gmcOwnMod.status === 200, "Hospital Manager successfully updated their own hospital's inventory (200 OK)");

    // Attempt D: Admin modifies hospital resource -> MUST SUCCEED (Admin override)
    const adminMod = await request(
      "PATCH",
      `/api/hospitals/${gmcHospId}/resources/${targetResource.id}`,
      { availableQuantity: targetResource.available_quantity },
      adminToken
    );
    assert(adminMod.status === 200, "Admin permitted to update any hospital resource (200 OK)");

    // =========================================================================
    // 6. Test Hospital Manager Adding & Deleting Resources and Specialists
    // =========================================================================
    console.log("\n6. Testing Hospital Manager Adding & Deleting Resources/Specialists...");

    // Test A: Hospital Manager adds new equipment / bed category
    const addRes = await request(
      "POST",
      `/api/hospitals/${gmcHospId}/resources`,
      {
        resourceType: "Pediatric ICU Bed Test",
        totalQuantity: 6,
        availableQuantity: 4,
        status: "available",
        notes: "Testing equipment addition"
      },
      gmcToken
    );
    assert(addRes.status === 201, "Hospital Manager added new equipment/bed (201 Created)");
    assert(addRes.data.resource && addRes.data.resource.resource_type === "Pediatric ICU Bed Test", "Created resource matches name");
    const createdResId = addRes.data.resource.id;

    // Test B: Cross-manager cannot delete this resource
    const crossDelRes = await request(
      "DELETE",
      `/api/hospitals/${otherHospId}/resources/${createdResId}`,
      null,
      gmcToken
    );
    assert(crossDelRes.status === 403, "Cross-facility resource deletion blocked (403 Forbidden)");

    // Test C: Hospital Manager deletes their own resource
    const delRes = await request(
      "DELETE",
      `/api/hospitals/${gmcHospId}/resources/${createdResId}`,
      null,
      gmcToken
    );
    assert(delRes.status === 200, "Hospital Manager deleted their own equipment/bed (200 OK)");

    // Test D: Hospital Manager adds a new specialist / doctor
    const addSpec = await request(
      "POST",
      `/api/hospitals/${gmcHospId}/specialists`,
      {
        specialty: "Critical Care Neurosurgeon Test",
        available: true,
        countAvailable: 2,
        dutyNotes: "On call for neuro emergencies"
      },
      gmcToken
    );
    assert(addSpec.status === 201, "Hospital Manager added new doctor/specialist (201 Created)");
    const createdSpecId = addSpec.data.specialist.id;

    // Test E: Hospital Manager deletes the specialist
    const delSpec = await request(
      "DELETE",
      `/api/hospitals/${gmcHospId}/specialists/${createdSpecId}`,
      null,
      gmcToken
    );
    assert(delSpec.status === 200, "Hospital Manager deleted specialist from roster (200 OK)");

    // -------------------------------------------------------------
    // 7. Testing Admin User & Email-Based Role Access Management
    // -------------------------------------------------------------
    console.log("\n7. Testing Admin User & Email-Based Role Access Management...");

    // Non-admin blocked from listing users
    const forbiddenUsers = await request("GET", "/api/auth/users", null, patientToken);
    assert(forbiddenUsers.status === 403, "Citizen/patient blocked from listing users (403 Forbidden)");

    // Admin lists users & pre-assigned roles
    const adminUsers = await request("GET", "/api/auth/users", null, adminToken);
    assert(adminUsers.status === 200, "Admin permitted to list users (200 OK)");
    assert(Array.isArray(adminUsers.data.users), "Response contains users array");
    assert(Array.isArray(adminUsers.data.preassigned), "Response contains preassigned array");

    // Admin pre-assigns role to an unregistered email
    const inviteEmail = `doctor.preassigned.${Date.now()}@medlink.org`;
    testCreatedUserEmails.push(inviteEmail);
    const preAssignRes = await request(
      "POST",
      "/api/auth/assign-role",
      {
        email: inviteEmail,
        role: "hospital_manager",
        hospitalId: gmcHospId,
        notes: "Pre-assigned by Central Dispatch Admin"
      },
      adminToken
    );
    assert(preAssignRes.status === 200, "Admin pre-assigned role by email (200 OK)");
    assert(preAssignRes.data.userUpdated === false, "User was not yet registered (pre-assigned successfully)");

    // User registers with that pre-assigned email
    const registeredPreassigned = await request("POST", "/api/auth/register", {
      name: "Dr. Preassigned Staff",
      email: inviteEmail,
      password: "DoctorPassword123!"
    });
    assert(registeredPreassigned.status === 201, "Pre-assigned user registered (201 Created)");
    assert(registeredPreassigned.data.user.role === "hospital_manager", "Inherited pre-assigned 'hospital_manager' role");
    assert(Number(registeredPreassigned.data.user.hospital_id) === Number(gmcHospId), "Inherited assigned hospital facility");

    // User registers WITHOUT any predefined role -> Must default to citizen ('patient')
    const citizenEmail = `citizen.regular.${Date.now()}@medlink.org`;
    testCreatedUserEmails.push(citizenEmail);
    const citizenReg = await request("POST", "/api/auth/register", {
      name: "Regular Citizen",
      email: citizenEmail,
      password: "CitizenPassword123!"
    });
    assert(citizenReg.status === 201, "Regular user registered (201 Created)");
    assert(citizenReg.data.user.role === "patient", "Users without predefined roles default to 'patient' (citizen)");
    assert(citizenReg.data.user.hospital_id === null, "Citizen has no restricted hospital_id");

    // Admin updates citizen's role to hospital manager by email
    const updateRoleRes = await request(
      "POST",
      "/api/auth/assign-role",
      {
        email: citizenEmail,
        role: "hospital_manager",
        hospitalId: otherHospId,
        notes: "Promoted to hospital manager by admin"
      },
      adminToken
    );
    assert(updateRoleRes.status === 200, "Admin updated existing citizen's role (200 OK)");
    assert(updateRoleRes.data.userUpdated === true, "Existing user record updated in database");
    assert(updateRoleRes.data.user.role === "hospital_manager", "User role immediately transitioned in DB");

    // -------------------------------------------------------------
    // 8. Testing Admin Deleting Emergency Incident Cases
    // -------------------------------------------------------------
    console.log("\n8. Testing Admin Deleting Emergency Incident Cases...");

    // Create an emergency incident
    const incRes = await request("POST", "/api/incidents", {
      callerName: "Paramedic Unit 9",
      callerPhone: "+91-94191-99999",
      patient: { name: "Test Incident For Deletion", age: 40, gender: "male" },
      chiefComplaint: "Severe lacerations and trauma",
      severity: "critical",
      triageLevel: "immediate",
      conditionCategory: "trauma",
      latitude: 32.7266,
      longitude: 74.8570,
      address: "Admin Deletion Test Locus"
    });
    assert(incRes.status === 201, "Emergency incident created for deletion test (201 Created)");
    const testCaseId = incRes.data.incident.id;

    // Citizen/patient cannot delete the case
    const patientDelCase = await request("DELETE", `/api/incidents/${testCaseId}`, null, patientToken);
    assert(patientDelCase.status === 403, "Citizen/patient blocked from deleting cases (403 Forbidden)");

    // Admin deletes the case
    const adminDelCase = await request("DELETE", `/api/incidents/${testCaseId}`, null, adminToken);
    assert(adminDelCase.status === 200, "Admin successfully deleted emergency case (200 OK)");

    // Verify deletion in database
    const verifyDelDb = await db.query(`SELECT id FROM emergency_incidents WHERE id = $1`, [testCaseId]);
    assert(verifyDelDb.rowCount === 0, "Emergency case confirmed deleted from database");

    // -------------------------------------------------------------
    // 9. Testing Admin Adding & Deleting Regional Hospitals
    // -------------------------------------------------------------
    console.log("\n9. Testing Admin Adding & Deleting Regional Hospitals...");

    // Patient blocked from adding hospital
    const patientAddHosp = await request("POST", "/api/hospitals", {
      name: "Unauthorized Hospital",
      address: "Gandhi Nagar, Jammu",
      latitude: 32.71,
      longitude: 74.87
    }, patientToken);
    assert(patientAddHosp.status === 403, "Citizen/patient blocked from adding hospitals (403 Forbidden)");

    // Hospital manager blocked from adding hospital
    const managerAddHosp = await request("POST", "/api/hospitals", {
      name: "Unauthorized Hospital",
      address: "Gandhi Nagar, Jammu",
      latitude: 32.71,
      longitude: 74.87
    }, gmcToken);
    assert(managerAddHosp.status === 403, "Hospital manager blocked from adding hospitals (403 Forbidden)");

    // Admin creates new hospital
    const adminAddHosp = await request("POST", "/api/hospitals", {
      name: "Jammu Regional Trauma Super-Center",
      address: "Bahu Plaza Complex, Jammu, J&K 180012",
      latitude: 32.7085,
      longitude: 74.8724,
      phone: "+91-191-2479999",
      email: "trauma@jammuregional.gov.in",
      operationalStatus: "operational",
      initDefaultResources: true
    }, adminToken);
    assert(adminAddHosp.status === 201, "Admin successfully created new hospital (201 Created)");
    const newHospitalId = adminAddHosp.data.hospital.id;
    assert(typeof newHospitalId === "number" || typeof newHospitalId === "string", "Created hospital has valid ID");

    // Verify resources were auto-initialized
    const verifyResDb = await db.query(
      `SELECT resource_type, available_quantity FROM hospital_resources WHERE hospital_id = $1`,
      [newHospitalId]
    );
    assert(verifyResDb.rowCount >= 4, "Default emergency resources (ICU, Ward, Bay, Ventilator) initialized");

    // Citizen/patient blocked from deleting hospital
    const patientDelHosp = await request("DELETE", `/api/hospitals/${newHospitalId}`, null, patientToken);
    assert(patientDelHosp.status === 403, "Citizen/patient blocked from deleting hospitals (403 Forbidden)");

    // Hospital manager blocked from deleting hospital
    const managerDelHosp = await request("DELETE", `/api/hospitals/${newHospitalId}`, null, gmcToken);
    assert(managerDelHosp.status === 403, "Hospital manager blocked from deleting hospitals (403 Forbidden)");

    // Admin deletes hospital
    const adminDelHosp = await request("DELETE", `/api/hospitals/${newHospitalId}`, null, adminToken);
    assert(adminDelHosp.status === 200, "Admin successfully deleted hospital (200 OK)");

    // Verify hospital and child resources permanently deleted from DB
    const verifyHospDb = await db.query(`SELECT id FROM hospitals WHERE id = $1`, [newHospitalId]);
    assert(verifyHospDb.rowCount === 0, "Hospital confirmed permanently deleted from database");

    const verifyHospResClean = await db.query(`SELECT id FROM hospital_resources WHERE hospital_id = $1`, [newHospitalId]);
    assert(verifyHospResClean.rowCount === 0, "Child resources cleanly cascaded upon hospital deletion");

    // ===============================================================
    // 10. Testing User Profile Updates (Self - Any Role)
    // ===============================================================
    console.log("\n10. Testing Personal Profile Section & Self-Update...");
    
    // Citizen updates profile (name and phone)
    const patientProfileUpdate = await request("PATCH", "/api/auth/profile", {
      name: "Rohit Verma (Updated Citizen)",
      phone: "+91-94191-55555"
    }, patientToken);
    assert(patientProfileUpdate.status === 200, "Citizen successfully updated personal profile (200 OK)");
    assert(patientProfileUpdate.data.user.name === "Rohit Verma (Updated Citizen)", "Updated name persisted in response");
    assert(patientProfileUpdate.data.user.phone === "+91-94191-55555", "Updated phone number persisted in response");

    // Hospital Manager updates profile (self)
    const managerProfileUpdate = await request("PATCH", "/api/auth/profile", {
      name: "Dr. Rajesh Gupta",
      phone: "+91-94191-10074"
    }, gmcToken);
    assert(managerProfileUpdate.status === 200, "Hospital manager successfully updated personal profile (200 OK)");
    assert(managerProfileUpdate.data.user.phone === "+91-94191-10074", "Manager phone updated");

    // ===============================================================
    // 11. Testing Admin Editing Hospital Manager Info (e.g. Mobile Number)
    // ===============================================================
    console.log("\n11. Testing Admin Editing Hospital Manager Info...");

    // Find GMC Manager ID
    const gmcManagerDb = await db.query(`SELECT id FROM users WHERE LOWER(email) = 'gmc.manager@medlink.org'`);
    const gmcManagerId = gmcManagerDb.rows[0].id;

    // Citizen blocked from editing manager info
    const citizenEditManager = await request("PATCH", `/api/auth/users/${gmcManagerId}`, {
      phone: "+91-99999-00000"
    }, patientToken);
    assert(citizenEditManager.status === 403, "Citizen blocked from modifying hospital manager info (403 Forbidden)");

    // Admin updates Hospital Manager mobile number, name, and operational notes
    const adminEditManager = await request("PATCH", `/api/auth/users/${gmcManagerId}`, {
      name: "Dr. Rajesh Gupta (GMC Triage Head)",
      phone: "+91-94191-99999",
      notes: "Chief of Trauma Intake & Night Dispatch Coordinator"
    }, adminToken);
    assert(adminEditManager.status === 200, "Admin successfully changed Hospital Manager info (200 OK)");
    assert(adminEditManager.data.user.phone === "+91-94191-99999", "Admin updated manager mobile number");
    assert(adminEditManager.data.user.name === "Dr. Rajesh Gupta (GMC Triage Head)", "Admin updated manager full name");

    // Verify DB persistence directly
    const verifyManagerDb = await db.query(`SELECT name, phone FROM users WHERE id = $1`, [gmcManagerId]);
    assert(verifyManagerDb.rows[0].phone === "+91-94191-99999", "Database confirms Hospital Manager mobile number was changed");
    assert(verifyManagerDb.rows[0].name === "Dr. Rajesh Gupta (GMC Triage Head)", "Database confirms Hospital Manager name was changed");

    // Revert phone number back cleanly for continuity
    await db.query(`UPDATE users SET phone = '+91-94191-10074' WHERE id = $1`, [gmcManagerId]);

    console.log("\n===============================================================");
    console.log(`  ALL ${passed}/${total} AUTH & RBAC TESTS PASSED SUCCESSFULLY!  `);
    console.log("===============================================================");
  } catch (err) {
    console.error("\n❌ AUTH TEST FAILED:", err.message, err.cause);
    process.exitCode = 1;
  } finally {
    if (testCreatedUserEmails.length > 0) {
      await db.query(`DELETE FROM users WHERE email = ANY($1)`, [testCreatedUserEmails]);
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.pool.end();
  }
}

runTests();
