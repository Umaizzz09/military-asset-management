const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRoles = require("./roleMiddleware");

const router = express.Router();


// ============================================================
// GET AUDIT LOGS
// ADMIN ONLY
// ============================================================

router.get(
  "/",
  authenticateToken,
  authorizeRoles("Admin"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          audit_logs.id,
          audit_logs.action,
          audit_logs.entity_type,
          audit_logs.entity_id,
          audit_logs.details,
          audit_logs.ip_address,
          audit_logs.created_at,
          users.id AS user_id,
          users.name AS user_name,
          users.email AS user_email,
          roles.name AS user_role
        FROM audit_logs
        LEFT JOIN users
          ON audit_logs.user_id = users.id
        LEFT JOIN roles
          ON users.role_id = roles.id
        ORDER BY audit_logs.created_at DESC
        `
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Error fetching audit logs:",
        error
      );

      res.status(500).json({
        message: "Failed to fetch audit logs",
      });
    }
  }
);

module.exports = router;