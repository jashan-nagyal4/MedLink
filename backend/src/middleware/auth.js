/**
 * MedLink Authentication & Authorization Middleware
 * 
 * Supports JWT authentication and Role-Based Access Control (RBAC):
 * - admin: full system access
 * - hospital_manager: access to assigned hospital resources & incoming requests
 * - patient: citizen access for reporting & personal incident tracking
 */

const jwt = require("jsonwebtoken");
const db = require("../config/db");

// In production, JWT_SECRET must be explicitly provided in environment variables
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "medlink_dev_insecure_jwt_secret_do_not_use_in_prod");

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("❌ CRITICAL SECURITY ALERT: JWT_SECRET environment variable must be set in production mode.");
}

/**
 * Verifies Bearer JWT Token from Authorization header
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Access denied. No authorization token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists in database
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.hospital_id, u.phone,
              h.name AS hospital_name
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (!userRes.rowCount) {
      return res.status(401).json({ error: "Invalid token. User no longer exists." });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    return res.status(403).json({ error: "Invalid token." });
  }
}

/**
 * Optional Authentication: Attaches req.user if token present, but does not block if absent
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.hospital_id, u.phone,
              h.name AS hospital_name
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = $1`,
      [decoded.id]
    );
    req.user = userRes.rows[0] || null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Role check middleware: Requires user to hold one of the specified roles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (req.user.role === "admin") {
      // Admins bypass role checks
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Action requires role: ${allowedRoles.join(" or ")}. Your role is '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Verifies that a hospital manager is authorized for the target hospital
 */
function requireHospitalAuthorization(hospitalIdGetter) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (req.user.role === "admin") {
      return next();
    }

    const targetHospId = typeof hospitalIdGetter === "function" ? hospitalIdGetter(req) : req.params.id;

    if (req.user.role === "hospital_manager" || req.user.role === "hospital_staff") {
      if (Number(req.user.hospital_id) !== Number(targetHospId)) {
        return res.status(403).json({
          error: `Forbidden. You are assigned to Hospital #${req.user.hospital_id} (${req.user.hospital_name || 'Hospital'}), cannot modify Hospital #${targetHospId}.`
        });
      }
      return next();
    }

    return res.status(403).json({ error: "Forbidden. Hospital manager access required." });
  };
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireHospitalAuthorization,
  JWT_SECRET
};
