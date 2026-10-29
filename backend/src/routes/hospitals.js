/**
 * Hospital Management Routes
 * Handles CRUD and PostGIS spatial queries for hospitals.
 */

const express = require("express");
const db = require("../config/db");
const socketService = require("../services/socketService");
const { authenticateToken, optionalAuth, requireRole, requireHospitalAuthorization } = require("../middleware/auth");

const router = express.Router();

/**
 * 1. Find Nearby Hospitals using PostGIS ST_DWithin and ST_Distance
 * Example: GET /api/hospitals/nearby?lat=32.7266&lng=74.8570&radius=15000
 */
router.get("/nearby", async (req, res, next) => {
  try {
    const { lat, lng, radius = 25000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng query parameters are required." });
    }

    const query = `
      SELECT h.id, h.name, h.address, h.phone, h.operational_status,
             ST_Y(h.location::geometry) AS latitude,
             ST_X(h.location::geometry) AS longitude,
             ROUND(ST_Distance(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric) AS distance_meters
      FROM hospitals h
      WHERE h.operational_status <> 'closed'
        AND ST_DWithin(h.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      ORDER BY distance_meters ASC
    `;

    const result = await db.query(query, [Number(lng), Number(lat), Number(radius)]);

    res.json({
      count: result.rowCount,
      radiusMeters: Number(radius),
      hospitals: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Get All Hospitals
 */
router.get("/", async (req, res, next) => {
  try {
    const query = `
      SELECT h.id, h.name, h.address, h.phone, h.email, h.operational_status,
             ST_Y(h.location::geometry) AS latitude,
             ST_X(h.location::geometry) AS longitude,
             h.created_at,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%icu%' THEN r.available_quantity ELSE 0 END), 0)::int AS icu_available,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%icu%' THEN r.total_quantity ELSE 0 END), 0)::int AS icu_total,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%general%' OR r.resource_type ILIKE '%ward%' THEN r.available_quantity ELSE 0 END), 0)::int AS general_available,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%general%' OR r.resource_type ILIKE '%ward%' THEN r.total_quantity ELSE 0 END), 0)::int AS general_total,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%ventilator%' THEN r.available_quantity ELSE 0 END), 0)::int AS ventilators_available,
             COALESCE(SUM(CASE WHEN r.resource_type ILIKE '%ventilator%' THEN r.total_quantity ELSE 0 END), 0)::int AS ventilators_total,
             COALESCE((SELECT SUM(units_available) FROM hospital_blood_inventory b WHERE b.hospital_id = h.id), 0)::int AS blood_units_total,
             COALESCE((SELECT COUNT(*) FROM hospital_specialists s WHERE s.hospital_id = h.id AND s.available = true), 0)::int AS specialists_on_duty,
             COALESCE((SELECT COUNT(*) FROM hospital_specialists s WHERE s.hospital_id = h.id), 0)::int AS specialists_total
      FROM hospitals h
      LEFT JOIN hospital_resources r ON h.id = r.hospital_id
      GROUP BY h.id
      ORDER BY h.name ASC
    `;
    const result = await db.query(query);
    res.json({
      count: result.rowCount,
      hospitals: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Get Single Hospital by ID with its Resources and Specialists
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const hospitalRes = await db.query(
      `SELECT id, name, address, phone, email, operational_status,
              ST_Y(location::geometry) AS latitude,
              ST_X(location::geometry) AS longitude
       FROM hospitals WHERE id = $1`,
      [id]
    );

    if (!hospitalRes.rowCount) {
      return res.status(404).json({ error: "Hospital not found." });
    }

    const [resourcesRes, specialistsRes, bloodRes] = await Promise.all([
      db.query("SELECT * FROM hospital_resources WHERE hospital_id = $1 ORDER BY resource_type", [id]),
      db.query("SELECT * FROM hospital_specialists WHERE hospital_id = $1 ORDER BY COALESCE(department, specialty) ASC, specialty ASC, doctor_name ASC", [id]),
      db.query("SELECT * FROM hospital_blood_inventory WHERE hospital_id = $1 ORDER BY id ASC", [id])
    ]);

    res.json({
      hospital: hospitalRes.rows[0],
      resources: resourcesRes.rows,
      specialists: specialistsRes.rows,
      bloodInventory: bloodRes.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 4. Add a New Hospital (Admin Only)
 * POST /api/hospitals
 */
router.post("/", optionalAuth, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Only administrators can add new hospitals." });
    }

    const {
      name,
      address,
      phone,
      email,
      latitude,
      longitude,
      operationalStatus = "operational",
      initDefaultResources = true
    } = req.body || {};

    if (!name || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "name, address, latitude and longitude are required." });
    }

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const query = `
        INSERT INTO hospitals (name, address, phone, email, location, operational_status)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
        RETURNING id, name, address, phone, email, operational_status,
                  ST_Y(location::geometry) AS latitude,
                  ST_X(location::geometry) AS longitude,
                  created_at
      `;

      const result = await client.query(query, [
        name.trim(),
        address.trim(),
        phone || null,
        email || null,
        Number(longitude),
        Number(latitude),
        operationalStatus
      ]);

      const hospital = result.rows[0];

      // Automatically populate starter bed & ventilator inventory for the new facility
      if (initDefaultResources) {
        const defaultResources = [
          ["ICU Bed", 8, 5, "available"],
          ["General Ward Bed", 25, 18, "available"],
          ["Emergency Resuscitation Bay", 4, 3, "available"],
          ["Mechanical Ventilator", 6, 4, "available"],
          ["Defibrillator Unit", 5, 4, "available"]
        ];

        for (const [resType, total, avail, status] of defaultResources) {
          await client.query(
            `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (hospital_id, resource_type) DO NOTHING`,
            [hospital.id, resType, total, avail, status]
          );
        }
      }

      await client.query("COMMIT");

      socketService.broadcastHospitalCreated(hospital);

      res.status(201).json({
        success: true,
        message: "Hospital created successfully.",
        hospital
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * 4b. Delete Hospital (Admin Only)
 * DELETE /api/hospitals/:id
 */
router.delete("/:id", optionalAuth, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Only administrators can delete hospitals." });
    }

    const { id } = req.params;
    const hospitalRes = await db.query(`SELECT id, name FROM hospitals WHERE id = $1`, [id]);
    if (!hospitalRes.rowCount) {
      return res.status(404).json({ error: "Hospital not found." });
    }
    const targetHospital = hospitalRes.rows[0];

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Demote any hospital managers assigned to this hospital to citizens to prevent check constraint violations
      await client.query(
        `UPDATE users SET role = 'patient', hospital_id = NULL, updated_at = NOW() WHERE hospital_id = $1`,
        [id]
      );

      // 2. Remove any preassigned email roles linked to this hospital
      await client.query(
        `DELETE FROM preassigned_roles WHERE hospital_id = $1`,
        [id]
      );

      // 3. Clear active incident hospital associations so incidents aren't broken
      await client.query(
        `UPDATE emergency_incidents SET assigned_hospital_id = NULL WHERE assigned_hospital_id = $1`,
        [id]
      );
      await client.query(
        `UPDATE emergency_incidents SET referring_hospital_id = NULL WHERE referring_hospital_id = $1`,
        [id]
      );
      await client.query(
        `UPDATE emergency_incidents SET current_dispatch_hospital_id = NULL WHERE current_dispatch_hospital_id = $1`,
        [id]
      );

      // 4. Delete the hospital itself (cascades to hospital_resources, hospital_specialists, and dispatch logs)
      await client.query(
        `DELETE FROM hospitals WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");

      socketService.broadcastHospitalDeleted(id);

      res.json({
        success: true,
        message: `Hospital '${targetHospital.name}' deleted successfully from regional network.`,
        hospitalId: Number(id),
        hospital: targetHospital
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * 5. Update Hospital Resource Capacity (Beds, Ventilators, etc.)
 * PATCH /api/hospitals/:id/resources/:resourceId
 * Requires Hospital Manager of this facility or Admin
 */
router.patch("/:id/resources/:resourceId",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id, resourceId } = req.params;
      const { availableQuantity, totalQuantity, status, notes } = req.body || {};

      const result = await db.query(
        `UPDATE hospital_resources
         SET available_quantity = COALESCE($1, available_quantity),
             total_quantity = COALESCE($2, total_quantity),
             status = COALESCE($3, status),
             notes = COALESCE($4, notes),
             updated_at = NOW()
         WHERE id = $5 AND hospital_id = $6
         RETURNING *`,
        [availableQuantity, totalQuantity, status, notes, resourceId, id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Resource not found for this hospital." });
      }

      const updatedResource = result.rows[0];

      // Broadcast live update over Socket.IO to all dispatchers
      socketService.broadcastHospitalUpdate(id, {
        resource: updatedResource,
        updatedBy: req.user.name
      });

      res.json({
        success: true,
        message: "Resource capacity updated.",
        resource: updatedResource
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 6. Update Hospital Specialist On-Duty Status & Shift
 * PATCH /api/hospitals/:id/specialists/:specialistId
 * Requires Hospital Manager of this facility or Admin
 */
router.patch("/:id/specialists/:specialistId",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id, specialistId } = req.params;
      const { available, countAvailable, dutyNotes, doctorName, shift, onDuty, contactPhone, department, specialty } = req.body || {};

      const result = await db.query(
        `UPDATE hospital_specialists
         SET available = COALESCE($1, available),
             count_available = COALESCE($2, count_available),
             duty_notes = COALESCE($3, duty_notes),
             doctor_name = COALESCE($4, doctor_name),
             shift = COALESCE($5, shift),
             on_duty = COALESCE($6, on_duty),
             contact_phone = COALESCE($7, contact_phone),
             department = COALESCE($8, department),
             specialty = COALESCE($9, specialty),
             updated_at = NOW()
         WHERE id = $10 AND hospital_id = $11
         RETURNING *`,
        [available, countAvailable, dutyNotes, doctorName, shift, onDuty, contactPhone, department, specialty, specialistId, id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Specialist record not found for this hospital." });
      }

      const updatedSpecialist = result.rows[0];

      // Broadcast live update over Socket.IO
      socketService.broadcastHospitalUpdate(id, {
        action: "specialist_updated",
        specialist: updatedSpecialist,
        updatedBy: req.user.name
      });

      res.json({
        success: true,
        message: "Specialist on-duty status updated.",
        specialist: updatedSpecialist
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 6b. Toggle Doctor On-Duty Shift Status (1-Click)
 * PATCH /api/hospitals/:id/specialists/:specialistId/toggle-duty
 */
router.patch("/:id/specialists/:specialistId/toggle-duty",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id, specialistId } = req.params;

      const result = await db.query(
        `UPDATE hospital_specialists
         SET on_duty = NOT on_duty,
             available = NOT on_duty,
             count_available = CASE WHEN on_duty = false THEN 1 ELSE 0 END,
             updated_at = NOW()
         WHERE id = $1 AND hospital_id = $2
         RETURNING *`,
        [specialistId, id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Specialist record not found for this hospital." });
      }

      const updatedSpecialist = result.rows[0];

      socketService.broadcastHospitalUpdate(id, {
        action: "specialist_duty_toggled",
        specialist: updatedSpecialist,
        updatedBy: req.user.name
      });

      res.json({
        success: true,
        message: `Dr. ${updatedSpecialist.doctor_name || updatedSpecialist.specialty} set to ${updatedSpecialist.on_duty ? 'ON DUTY' : 'OFF DUTY'}.`,
        specialist: updatedSpecialist
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 7. Add New Hospital Resource (Beds, Ventilators, Monitors, etc.)
 * POST /api/hospitals/:id/resources
 */
router.post("/:id/resources",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { resourceType, totalQuantity = 1, availableQuantity = 1, status = "available", notes = null } = req.body || {};

      if (!resourceType || !resourceType.trim()) {
        return res.status(400).json({ error: "resourceType is required." });
      }

      const total = Math.max(0, Number(totalQuantity) || 0);
      const avail = Math.min(total, Math.max(0, Number(availableQuantity) || 0));

      const result = await db.query(
        `INSERT INTO hospital_resources (hospital_id, resource_type, total_quantity, available_quantity, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (hospital_id, resource_type) DO UPDATE
         SET total_quantity = EXCLUDED.total_quantity,
             available_quantity = EXCLUDED.available_quantity,
             status = EXCLUDED.status,
             notes = COALESCE(EXCLUDED.notes, hospital_resources.notes),
             updated_at = NOW()
         RETURNING *`,
        [id, resourceType.trim(), total, avail, status, notes]
      );

      const savedResource = result.rows[0];

      socketService.broadcastHospitalUpdate(id, {
        action: "resource_created",
        resource: savedResource,
        updatedBy: req.user.name
      });

      res.status(201).json({
        success: true,
        message: "Resource added successfully.",
        resource: savedResource
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 8. Delete Hospital Resource
 * DELETE /api/hospitals/:id/resources/:resourceId
 */
router.delete("/:id/resources/:resourceId",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id, resourceId } = req.params;

      const result = await db.query(
        `DELETE FROM hospital_resources
         WHERE id = $1 AND hospital_id = $2
         RETURNING *`,
        [resourceId, id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Resource not found for this hospital." });
      }

      socketService.broadcastHospitalUpdate(id, {
        action: "resource_deleted",
        resourceId: Number(resourceId),
        updatedBy: req.user.name
      });

      res.json({
        success: true,
        message: "Resource removed successfully.",
        deletedResource: result.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 9. Add New Hospital Specialist / Doctor with Shift
 * POST /api/hospitals/:id/specialists
 */
router.post("/:id/specialists",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        specialty,
        department = null,
        available = true,
        countAvailable = 1,
        dutyNotes = null,
        doctorName = null,
        shift = "Morning (08:00 - 16:00)",
        onDuty = true,
        contactPhone = null
      } = req.body || {};

      if (!specialty || !specialty.trim()) {
        return res.status(400).json({ error: "specialty is required." });
      }

      const count = Math.max(0, Number(countAvailable) || 0);
      const isAvail = Boolean(available && count > 0 && onDuty);

      // Check if this doctor or specialty already exists for this hospital
      let existing;
      if (doctorName && doctorName.trim()) {
        existing = await db.query(
          `SELECT id FROM hospital_specialists WHERE hospital_id = $1 AND LOWER(doctor_name) = LOWER($2)`,
          [id, doctorName.trim()]
        );
      } else {
        existing = await db.query(
          `SELECT id FROM hospital_specialists WHERE hospital_id = $1 AND LOWER(specialty) = LOWER($2) AND doctor_name IS NULL`,
          [id, specialty.trim()]
        );
      }

      let result;
      if (existing && existing.rowCount > 0) {
        result = await db.query(
          `UPDATE hospital_specialists
           SET specialty = $1,
               department = COALESCE($2, hospital_specialists.department),
               available = $3,
               count_available = $4,
               duty_notes = COALESCE($5, hospital_specialists.duty_notes),
               shift = COALESCE($6, hospital_specialists.shift),
               on_duty = $7,
               contact_phone = COALESCE($8, hospital_specialists.contact_phone),
               updated_at = NOW()
           WHERE id = $9
           RETURNING *`,
          [specialty.trim(), department, isAvail, count, dutyNotes, shift, onDuty, contactPhone, existing.rows[0].id]
        );
      } else {
        result = await db.query(
          `INSERT INTO hospital_specialists (hospital_id, specialty, department, available, count_available, duty_notes, doctor_name, shift, on_duty, contact_phone, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING *`,
          [id, specialty.trim(), department, isAvail, count, dutyNotes, doctorName, shift, onDuty, contactPhone]
        );
      }

      const savedSpecialist = result.rows[0];

      socketService.broadcastHospitalUpdate(id, {
        action: "specialist_created",
        specialist: savedSpecialist,
        updatedBy: req.user.name
      });

      res.status(201).json({
        success: true,
        message: "Specialist added successfully.",
        specialist: savedSpecialist
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 10. Delete Hospital Specialist
 * DELETE /api/hospitals/:id/specialists/:specialistId
 */
router.delete("/:id/specialists/:specialistId",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id, specialistId } = req.params;

      const result = await db.query(
        `DELETE FROM hospital_specialists
         WHERE id = $1 AND hospital_id = $2
         RETURNING *`,
        [specialistId, id]
      );

      if (!result.rowCount) {
        return res.status(404).json({ error: "Specialist record not found for this hospital." });
      }

      socketService.broadcastHospitalUpdate(id, {
        action: "specialist_deleted",
        specialistId: Number(specialistId),
        updatedBy: req.user.name
      });

      res.json({
        success: true,
        message: "Specialist removed successfully.",
        deletedSpecialist: result.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 11. Get Hospital Blood Bank Inventory
 * GET /api/hospitals/:id/blood-inventory
 */
router.get("/:id/blood-inventory", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM hospital_blood_inventory WHERE hospital_id = $1 ORDER BY id ASC`,
      [id]
    );
    res.json({
      success: true,
      count: result.rowCount,
      bloodInventory: result.rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 12. Update Blood Bank Stock Units (Hospital Manager / Admin)
 * PUT /api/hospitals/:id/blood-inventory
 */
router.put("/:id/blood-inventory",
  authenticateToken,
  requireRole("admin", "hospital_manager"),
  requireHospitalAuthorization((req) => req.params.id),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { bloodGroup, unitsAvailable, status = "available" } = req.body || {};

      if (!bloodGroup || unitsAvailable === undefined) {
        return res.status(400).json({ error: "bloodGroup and unitsAvailable are required." });
      }

      const units = Math.max(0, parseInt(unitsAvailable, 10) || 0);

      const result = await db.query(
        `INSERT INTO hospital_blood_inventory (hospital_id, blood_group, units_available, status, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (hospital_id, blood_group) DO UPDATE
         SET units_available = EXCLUDED.units_available,
             status = EXCLUDED.status,
             updated_at = NOW()
         RETURNING *`,
        [id, bloodGroup.trim(), units, status]
      );

      const updatedRecord = result.rows[0];

      socketService.broadcastBloodUpdate(id, {
        bloodGroup: updatedRecord.blood_group,
        unitsAvailable: updatedRecord.units_available,
        status: updatedRecord.status,
        record: updatedRecord
      });

      res.json({
        success: true,
        message: `Updated ${updatedRecord.blood_group} stock to ${updatedRecord.units_available} units.`,
        record: updatedRecord
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
