const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRoles = require("./roleMiddleware");

const router = express.Router();

// =====================================================
// CREATE ASSIGNMENT
// Admin + Base Commander
// =====================================================

router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Base Commander"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        assetId,
        personnelName,
        quantity,
        assignedDate,
        notes,
      } = req.body;

      // -------------------------------------------------
      // Basic validation
      // -------------------------------------------------

      if (
        !assetId ||
        !personnelName ||
        !quantity ||
        !assignedDate
      ) {
        return res.status(400).json({
          message:
            "assetId, personnelName, quantity and assignedDate are required",
        });
      }

      if (Number(quantity) <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      await client.query("BEGIN");

      // -------------------------------------------------
      // Lock the inventory row
      //
      // For Base Commander:
      // only an asset belonging to their assigned base
      // can be selected.
      // -------------------------------------------------

      let assetQuery = `
        SELECT
          id,
          base_id,
          equipment_type_id,
          quantity
        FROM assets
        WHERE id = $1
      `;

      const assetParams = [assetId];

      if (req.user.role === "Base Commander") {
        if (!req.user.baseId) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message: "No base assigned to this user.",
          });
        }

        assetQuery += `
          AND base_id = $2
        `;

        assetParams.push(req.user.baseId);
      }

      assetQuery += `
        FOR UPDATE
      `;

      const assetResult = await client.query(
        assetQuery,
        assetParams
      );

      // -------------------------------------------------
      // Asset not found OR Base Commander tried to use
      // an asset belonging to another base.
      // -------------------------------------------------

      if (assetResult.rows.length === 0) {
        await client.query("ROLLBACK");

        if (req.user.role === "Base Commander") {
          return res.status(403).json({
            message:
              "You do not have permission to assign an asset from this base.",
          });
        }

        return res.status(404).json({
          message: "Asset not found",
        });
      }

      const asset = assetResult.rows[0];

      // -------------------------------------------------
      // Check inventory
      // -------------------------------------------------

      if (Number(asset.quantity) < Number(quantity)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Insufficient inventory for assignment",
        });
      }

      // -------------------------------------------------
      // Reduce available inventory
      // -------------------------------------------------

      await client.query(
        `UPDATE assets
         SET quantity = quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, assetId]
      );

      // -------------------------------------------------
      // Record assignment
      // -------------------------------------------------

      const assignmentResult = await client.query(
        `INSERT INTO assignments
        (
          asset_id,
          personnel_name,
          quantity,
          assigned_date,
          notes,
          assigned_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          assetId,
          personnelName,
          quantity,
          assignedDate,
          notes || null,
          req.user.userId,
        ]
      );

      // -------------------------------------------------
      // Audit log
      // -------------------------------------------------

      await client.query(
        `INSERT INTO audit_logs
        (
          user_id,
          action,
          entity_type,
          entity_id,
          details
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.userId,
          "CREATE_ASSIGNMENT",
          "assignment",
          assignmentResult.rows[0].id,
          JSON.stringify({
            assetId,
            baseId: asset.base_id,
            equipmentTypeId: asset.equipment_type_id,
            personnelName,
            quantity,
          }),
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Assignment created successfully",
        assignment: assignmentResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Assignment error:", error);

      res.status(500).json({
        message: "Failed to create assignment",
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET ASSIGNMENT HISTORY
//
// Admin = all assignments
// Base Commander = assignments from own base
// Logistics Officer = not allowed
// =====================================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT
        assignments.id,
        assignments.asset_id,
        assignments.personnel_name,
        assignments.quantity,
        assignments.assigned_date,
        assignments.returned_date,
        assignments.notes,
        assets.base_id,
        assets.equipment_type_id,
        bases.name AS base_name,
        equipment_types.name AS equipment_type,
        users.name AS assigned_by
      FROM assignments
      JOIN assets
        ON assignments.asset_id = assets.id
      JOIN bases
        ON assets.base_id = bases.id
      JOIN equipment_types
        ON assets.equipment_type_id = equipment_types.id
      JOIN users
        ON assignments.assigned_by = users.id
    `;

    const params = [];

    // -------------------------------------------------
    // Base Commander sees only assignments belonging
    // to their assigned base.
    // -------------------------------------------------

    if (req.user.role === "Base Commander") {
      if (!req.user.baseId) {
        return res.status(403).json({
          message: "No base assigned to this user.",
        });
      }

      query += `
        WHERE assets.base_id = $1
      `;

      params.push(req.user.baseId);
    }

    // -------------------------------------------------
    // Logistics Officer should not access assignments
    // -------------------------------------------------

    if (req.user.role === "Logistics Officer") {
      return res.status(403).json({
        message:
          "You do not have permission to view assignments.",
      });
    }

    query += `
      ORDER BY assignments.assigned_date DESC,
               assignments.id DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching assignments:", error);

    res.status(500).json({
      message: "Failed to fetch assignments",
    });
  }
});

module.exports = router;