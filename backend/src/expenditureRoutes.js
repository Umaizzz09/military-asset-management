const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRoles = require("./roleMiddleware");
const authorizeBase = require("./baseMiddleware");

const router = express.Router();

// =====================================================
// CREATE EXPENDITURE
// Admin + Base Commander
// =====================================================

router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Base Commander"),
  authorizeBase,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        baseId,
        equipmentTypeId,
        quantity,
        expenditureDate,
        reason,
      } = req.body;

      // -------------------------------------------------
      // Basic validation
      // -------------------------------------------------

      if (
        !baseId ||
        !equipmentTypeId ||
        !quantity ||
        !expenditureDate
      ) {
        return res.status(400).json({
          message:
            "baseId, equipmentTypeId, quantity and expenditureDate are required",
        });
      }

      if (Number(quantity) <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      await client.query("BEGIN");

      // -------------------------------------------------
      // Lock inventory row
      //
      // Base Commander can only access their own base.
      // Admin can access any base.
      // -------------------------------------------------

      let assetQuery = `
        SELECT
          id,
          base_id,
          equipment_type_id,
          quantity
        FROM assets
        WHERE base_id = $1
        AND equipment_type_id = $2
      `;

      const assetParams = [baseId, equipmentTypeId];

      if (req.user.role === "Base Commander") {
        if (!req.user.baseId) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message: "No base assigned to this user.",
          });
        }

        if (
          Number(baseId) !==
          Number(req.user.baseId)
        ) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            message:
              "You do not have permission to record expenditure for this base.",
          });
        }
      }

      assetQuery += `
        FOR UPDATE
      `;

      const assetResult = await client.query(
        assetQuery,
        assetParams
      );

      // -------------------------------------------------
      // Inventory does not exist
      // -------------------------------------------------

      if (assetResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "No inventory found for this equipment at the base",
        });
      }

      const asset = assetResult.rows[0];

      // -------------------------------------------------
      // Check available inventory
      // -------------------------------------------------

      if (
        Number(asset.quantity) <
        Number(quantity)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "Insufficient inventory for expenditure",
        });
      }

      // -------------------------------------------------
      // Reduce inventory
      // -------------------------------------------------

      await client.query(
        `UPDATE assets
         SET quantity = quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, asset.id]
      );

      // -------------------------------------------------
      // Record expenditure
      // -------------------------------------------------

      const expenditureResult = await client.query(
        `INSERT INTO expenditures
        (
          base_id,
          equipment_type_id,
          quantity,
          expenditure_date,
          reason,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          baseId,
          equipmentTypeId,
          quantity,
          expenditureDate,
          reason || null,
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
          "CREATE_EXPENDITURE",
          "expenditure",
          expenditureResult.rows[0].id,
          JSON.stringify({
            baseId,
            equipmentTypeId,
            quantity,
            reason: reason || null,
          }),
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message:
          "Expenditure recorded successfully",
        expenditure:
          expenditureResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Expenditure error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to record expenditure",
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET EXPENDITURE HISTORY
//
// Admin = all expenditures
// Base Commander = own base only
// Logistics Officer = denied
// =====================================================

router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      // -------------------------------------------------
      // Logistics Officer cannot view expenditures
      // -------------------------------------------------

      if (
        req.user.role ===
        "Logistics Officer"
      ) {
        return res.status(403).json({
          message:
            "You do not have permission to view expenditures.",
        });
      }

      let query = `
        SELECT
          expenditures.id,
          expenditures.base_id,
          expenditures.equipment_type_id,
          expenditures.quantity,
          expenditures.expenditure_date,
          expenditures.reason,
          bases.name AS base_name,
          equipment_types.name AS equipment_type,
          users.name AS created_by
        FROM expenditures
        JOIN bases
          ON expenditures.base_id = bases.id
        JOIN equipment_types
          ON expenditures.equipment_type_id =
             equipment_types.id
        JOIN users
          ON expenditures.created_by = users.id
      `;

      const params = [];

      // -------------------------------------------------
      // Base Commander sees only own base
      // -------------------------------------------------

      if (
        req.user.role ===
        "Base Commander"
      ) {
        if (!req.user.baseId) {
          return res.status(403).json({
            message:
              "No base assigned to this user.",
          });
        }

        query += `
          WHERE expenditures.base_id = $1
        `;

        params.push(req.user.baseId);
      }

      query += `
        ORDER BY
          expenditures.expenditure_date DESC,
          expenditures.id DESC
      `;

      const result =
        await pool.query(
          query,
          params
        );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Error fetching expenditures:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch expenditures",
      });
    }
  }
);

module.exports = router;