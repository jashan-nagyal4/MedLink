/**
 * Authentication Routes
 * 
 * Endpoints for Login, Registration, Profile fetch, and Demo Role Switcher.
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { authenticateToken, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      hospital_id: user.hospital_id
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

/**
 * 1. User Login
 * POST /api/auth/login
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, portal } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.hospital_id, u.phone,
              h.name AS hospital_name
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Role-based portal segregation enforcement
    if (portal === "citizen" && user.role !== "patient") {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    if (portal === "staff" && user.role === "patient") {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    // Strip password_hash before returning
    delete user.password_hash;
    const token = generateToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. User Registration (Citizen / Patient)
 * POST /api/auth/register
 */
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // Check if email already registered
    const existing = await db.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    );

    if (existing.rowCount) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedEmail = email.trim().toLowerCase();

    // Check if admin has pre-assigned a role for this email
    const preRes = await db.query(
      `SELECT role, hospital_id FROM preassigned_roles WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );

    let assignedRole = "patient"; // All users without predefined roles are considered citizens
    let assignedHospitalId = null;

    if (preRes.rowCount > 0) {
      assignedRole = preRes.rows[0].role;
      assignedHospitalId = preRes.rows[0].hospital_id;
    }

    const insertRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, hospital_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, hospital_id, phone, created_at`,
      [name.trim(), normalizedEmail, passwordHash, assignedRole, assignedHospitalId, phone || null]
    );

    const newUser = insertRes.rows[0];
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: assignedRole === "patient"
        ? "Citizen account registered successfully."
        : `Account registered successfully with pre-assigned role '${assignedRole}'.`,
      token,
      user: newUser
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Fetch Current Authenticated User Profile
 * GET /api/auth/me
 */
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

/**
 * 4. Get Pre-configured Demo Accounts for 1-Click Role Switcher
 * GET /api/auth/demo-users
 */
router.get("/demo-users", async (req, res, next) => {
  try {
    const demoAccounts = [
      {
        role: "admin",
        roleLabel: "Central Emergency Dispatcher (Admin)",
        description: "Full access to triage engine, live dispatch queue, PostGIS spatial search, and supervisor escalation controls.",
        email: "admin@medlink.org",
        password: "AdminPassword123!",
        avatar: "🛡️"
      },
      {
        role: "hospital_manager",
        roleLabel: "GMC Jammu Manager",
        description: "Manages live bed & specialist availability at Government Medical College Jammu and responds to targeted dispatch requests.",
        email: "gmc.manager@medlink.org",
        password: "HospitalPassword123!",
        avatar: "🏥"
      },
      {
        role: "hospital_manager",
        roleLabel: "ASCOMS & Batra Coordinator",
        description: "Triage desk officer for ASCOMS & Batra Hospital. Receives real-time emergency requests and handles allocations.",
        email: "batra.manager@medlink.org",
        password: "HospitalPassword123!",
        avatar: "🏥"
      },
      {
        role: "patient",
        roleLabel: "Citizen / Emergency Caller (Patient)",
        description: "Can submit emergency SOS requests with GPS pin, view real-time triage feedback, and track assigned ambulance.",
        email: "patient@medlink.org",
        password: "PatientPassword123!",
        avatar: "👤"
      }
    ];

    res.json({
      success: true,
      demoAccounts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin Privilege Guard Helper
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  next();
}

/**
 * 5. Admin: List All Registered Users & Pre-assigned Roles
 * GET /api/auth/users
 */
router.get("/users", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const usersResult = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.hospital_id, u.phone, u.created_at,
              h.name AS hospital_name
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       ORDER BY u.created_at DESC`
    );

    const preassignedResult = await db.query(
      `SELECT p.id, p.email, p.role, p.hospital_id, p.assigned_by, p.notes, p.created_at, p.updated_at,
              h.name AS hospital_name
       FROM preassigned_roles p
       LEFT JOIN hospitals h ON p.hospital_id = h.id
       ORDER BY p.updated_at DESC`
    );

    res.json({
      success: true,
      users: usersResult.rows,
      preassigned: preassignedResult.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 6. Admin: Assign / Update Role by Email
 * POST /api/auth/assign-role
 */
router.post("/assign-role", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    let { email, role, hospitalId, notes } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let normalizedRole = role.trim().toLowerCase();
    if (normalizedRole === "citizen") normalizedRole = "patient";

    if (!["admin", "hospital_manager", "patient"].includes(normalizedRole)) {
      return res.status(400).json({ error: "Invalid role. Must be 'admin', 'hospital_manager', or 'patient' (citizen)." });
    }

    if (normalizedRole === "hospital_manager" && !hospitalId) {
      return res.status(400).json({ error: "Hospital ID is required when assigning a Hospital Manager." });
    }

    const targetHospitalId = normalizedRole === "hospital_manager" ? hospitalId : null;

    // 1. Record or update preassigned role by email
    const preassignedRes = await db.query(
      `INSERT INTO preassigned_roles (email, role, hospital_id, assigned_by, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (email) DO UPDATE
       SET role = EXCLUDED.role, hospital_id = EXCLUDED.hospital_id, notes = EXCLUDED.notes, updated_at = NOW()
       RETURNING *`,
      [normalizedEmail, normalizedRole, targetHospitalId, req.user.email, notes || null]
    );

    // 2. If user already registered, update their role immediately
    const userUpdateRes = await db.query(
      `UPDATE users
       SET role = $1, hospital_id = $2, updated_at = NOW()
       WHERE LOWER(email) = LOWER($3)
       RETURNING id, name, email, role, hospital_id`,
      [normalizedRole, targetHospitalId, normalizedEmail]
    );

    const isExistingUser = userUpdateRes.rowCount > 0;

    res.json({
      success: true,
      message: isExistingUser
        ? `Role '${normalizedRole}' successfully applied to existing user ${normalizedEmail}.`
        : `Role '${normalizedRole}' pre-assigned for ${normalizedEmail}. Will be applied automatically upon registration.`,
      userUpdated: isExistingUser,
      user: isExistingUser ? userUpdateRes.rows[0] : null,
      preassigned: preassignedRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 7. Admin: Revoke / Delete Pre-assigned Role
 * DELETE /api/auth/preassigned/:id
 */
router.delete("/preassigned/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM preassigned_roles WHERE id = $1`, [id]);
    res.json({ success: true, message: "Pre-assigned role revoked successfully." });
  } catch (err) {
    next(err);
  }
});

/**
 * 8. Admin: Delete User Account
 * DELETE /api/auth/users/:id
 */
router.delete("/users/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (req.user.id === targetId) {
      return res.status(400).json({ error: "Cannot delete your own active administrator account." });
    }
    await db.query(`DELETE FROM users WHERE id = $1`, [targetId]);
    res.json({ success: true, message: "User account deleted successfully." });
  } catch (err) {
    next(err);
  }
});

/**
 * 9. Update Authenticated User Profile (Self - Any Level)
 * PATCH /api/auth/profile
 */
router.patch("/profile", authenticateToken, async (req, res, next) => {
  try {
    const { name, phone, password, currentPassword } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone && phone.trim() ? phone.trim() : null);
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      if (currentPassword) {
        const checkRes = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
        if (checkRes.rowCount > 0) {
          const match = await bcrypt.compare(currentPassword, checkRes.rows[0].password_hash);
          if (!match) {
            return res.status(401).json({ error: "Current password is incorrect." });
          }
        }
      }
      const newHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(newHash);
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, role, hospital_id, phone, created_at, updated_at
    `;

    const result = await db.query(query, values);
    const updated = result.rows[0];

    // Include hospital_name if manager
    let hospitalName = null;
    if (updated.hospital_id) {
      const hRes = await db.query(`SELECT name FROM hospitals WHERE id = $1`, [updated.hospital_id]);
      hospitalName = hRes.rows[0]?.name || null;
    }

    res.json({
      success: true,
      message: "Your profile has been updated successfully.",
      user: {
        ...updated,
        hospital_name: hospitalName
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 10. Admin: Update User / Hospital Manager Information (Mobile number, Name, Email, Facility, Memo, Role)
 * PATCH /api/auth/users/:id
 */
router.patch("/users/:id", authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const { name, phone, email, hospitalId, role, notes } = req.body || {};

    const existing = await db.query(`SELECT * FROM users WHERE id = $1`, [targetId]);
    if (!existing.rowCount) {
      return res.status(404).json({ error: "User account not found." });
    }

    const currentRecord = existing.rows[0];
    const finalRole = role !== undefined ? role.trim().toLowerCase() : currentRecord.role;
    const finalHospitalId = hospitalId !== undefined ? (hospitalId ? Number(hospitalId) : null) : currentRecord.hospital_id;

    if (finalRole === "hospital_manager" && !finalHospitalId) {
      return res.status(400).json({ error: "Hospital Manager must have an assigned regional healthcare facility." });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "Name cannot be empty." });
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone && phone.trim() ? phone.trim() : null);
    }

    if (email !== undefined) {
      const normEmail = email.trim().toLowerCase();
      if (!normEmail) return res.status(400).json({ error: "Email cannot be empty." });

      const emailConflict = await db.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
        [normEmail, targetId]
      );
      if (emailConflict.rowCount > 0) {
        return res.status(409).json({ error: "Email is already in use by another user account." });
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(normEmail);
    }

    if (role !== undefined) {
      let normRole = role.trim().toLowerCase();
      if (normRole === "citizen") normRole = "patient";
      if (!["admin", "hospital_manager", "patient"].includes(normRole)) {
        return res.status(400).json({ error: "Invalid role specified." });
      }
      updates.push(`role = $${paramIndex++}`);
      values.push(normRole);
    }

    if (hospitalId !== undefined) {
      updates.push(`hospital_id = $${paramIndex++}`);
      values.push(finalHospitalId);
    }

    if (updates.length === 0 && notes === undefined) {
      return res.status(400).json({ error: "No fields provided to update." });
    }

    let updated = currentRecord;
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(targetId);

      const query = `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, name, email, role, hospital_id, phone, created_at, updated_at
      `;
      const resUpdate = await db.query(query, values);
      updated = resUpdate.rows[0];
    }

    // If notes specified, update preassigned_roles record if exists or insert
    if (notes !== undefined) {
      await db.query(
        `UPDATE preassigned_roles
         SET notes = $1, updated_at = NOW()
         WHERE LOWER(email) = LOWER($2)`,
        [notes ? notes.trim() : null, updated.email]
      );
    }

    // Fetch hospital name
    let hospitalName = null;
    if (updated.hospital_id) {
      const hRes = await db.query(`SELECT name FROM hospitals WHERE id = $1`, [updated.hospital_id]);
      hospitalName = hRes.rows[0]?.name || null;
    }

    res.json({
      success: true,
      message: `User details for '${updated.name}' updated successfully.`,
      user: {
        ...updated,
        hospital_name: hospitalName
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
