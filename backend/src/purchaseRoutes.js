const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRoles = require("./roleMiddleware");

const router = express.Router();

// =====================================================
// CREATE PURCHASE
// Admin + Logistics Officer only
// =====================================================

router.post(
  "/",
  authenticateToken,
  authorizeRoles("Admin", "Logistics Officer"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const {
        baseId,
        equipmentTypeId,
        quantity,
        purchaseDate,
        referenceNumber,
        notes,
      } = req.body;

      if (!baseId || !equipmentTypeId || !quantity || !purchaseDate) {
        return res.status(400).json({
          message:
            "baseId, equipmentTypeId, quantity and purchaseDate are required",
        });
      }

      if (Number(quantity) <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      await client.query("BEGIN");

      // -------------------------------------------------
      // Record purchase
      // -------------------------------------------------

      const purchaseResult = await client.query(
        `INSERT INTO purchases
        (
          base_id,
          equipment_type_id,
          quantity,
          purchase_date,
          reference_number,
          notes,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          baseId,
          equipmentTypeId,
          quantity,
          purchaseDate,
          referenceNumber || null,
          notes || null,
          req.user.userId,
        ]
      );

      // -------------------------------------------------
      // Check whether inventory already exists
      // -------------------------------------------------

      const assetResult = await client.query(
        `SELECT id
         FROM assets
         WHERE base_id = $1
         AND equipment_type_id = $2
         FOR UPDATE`,
        [baseId, equipmentTypeId]
      );

      if (assetResult.rows.length > 0) {
        // Increase existing inventory
        await client.query(
          `UPDATE assets
           SET quantity = quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [quantity, assetResult.rows[0].id]
        );
      } else {
        // Create inventory record
        await client.query(
          `INSERT INTO assets
           (base_id, equipment_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [baseId, equipmentTypeId, quantity]
        );
      }

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
          "CREATE_PURCHASE",
          "purchase",
          purchaseResult.rows[0].id,
          JSON.stringify({
            baseId,
            equipmentTypeId,
            quantity,
          }),
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Purchase recorded successfully",
        purchase: purchaseResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Purchase error:", error);

      res.status(500).json({
        message: "Failed to record purchase",
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET PURCHASE HISTORY
// Admin + Logistics Officer = all purchases
// Base Commander = assigned base only
// =====================================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT
        purchases.id,
        purchases.base_id,
        purchases.equipment_type_id,
        purchases.quantity,
        purchases.purchase_date,
        purchases.reference_number,
        purchases.notes,
        bases.name AS base_name,
        equipment_types.name AS equipment_type,
        users.name AS created_by
      FROM purchases
      JOIN bases
        ON purchases.base_id = bases.id
      JOIN equipment_types
        ON purchases.equipment_type_id = equipment_types.id
      JOIN users
        ON purchases.created_by = users.id
    `;

    const params = [];

    // -------------------------------------------------
    // Base Commander can only see purchases
    // belonging to their assigned base.
    // -------------------------------------------------

    if (req.user.role === "Base Commander") {
      if (!req.user.baseId) {
        return res.status(403).json({
          message: "No base assigned to this user.",
        });
      }

      query += `
        WHERE purchases.base_id = $1
      `;

      params.push(req.user.baseId);
    }

    query += `
      ORDER BY purchases.purchase_date DESC,
               purchases.id DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching purchases:", error);

    res.status(500).json({
      message: "Failed to fetch purchases",
    });
  }
});

module.exports = router;