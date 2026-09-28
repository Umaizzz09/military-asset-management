const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");
const authorizeRoles = require("./roleMiddleware");

const router = express.Router();

// =====================================================
// CREATE TRANSFER
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
        fromBaseId,
        toBaseId,
        equipmentTypeId,
        quantity,
        transferDate,
        referenceNumber,
        notes,
      } = req.body;

      if (
        !fromBaseId ||
        !toBaseId ||
        !equipmentTypeId ||
        !quantity ||
        !transferDate
      ) {
        return res.status(400).json({
          message:
            "fromBaseId, toBaseId, equipmentTypeId, quantity and transferDate are required",
        });
      }

      if (Number(fromBaseId) === Number(toBaseId)) {
        return res.status(400).json({
          message: "Source and destination bases must be different",
        });
      }

      if (Number(quantity) <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      await client.query("BEGIN");

      // -------------------------------------------------
      // Lock source inventory row
      // -------------------------------------------------

      const sourceResult = await client.query(
        `SELECT id, quantity
         FROM assets
         WHERE base_id = $1
         AND equipment_type_id = $2
         FOR UPDATE`,
        [fromBaseId, equipmentTypeId]
      );

      if (sourceResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Source base does not have this equipment",
        });
      }

      const sourceAsset = sourceResult.rows[0];

      // -------------------------------------------------
      // Check source inventory
      // -------------------------------------------------

      if (Number(sourceAsset.quantity) < Number(quantity)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message: "Insufficient inventory at source base",
        });
      }

      // -------------------------------------------------
      // Decrease source inventory
      // -------------------------------------------------

      await client.query(
        `UPDATE assets
         SET quantity = quantity - $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, sourceAsset.id]
      );

      // -------------------------------------------------
      // Lock/check destination inventory
      // -------------------------------------------------

      const destinationResult = await client.query(
        `SELECT id
         FROM assets
         WHERE base_id = $1
         AND equipment_type_id = $2
         FOR UPDATE`,
        [toBaseId, equipmentTypeId]
      );

      if (destinationResult.rows.length > 0) {
        // Increase existing destination inventory
        await client.query(
          `UPDATE assets
           SET quantity = quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [quantity, destinationResult.rows[0].id]
        );
      } else {
        // Create destination inventory
        await client.query(
          `INSERT INTO assets
           (base_id, equipment_type_id, quantity)
           VALUES ($1, $2, $3)`,
          [toBaseId, equipmentTypeId, quantity]
        );
      }

      // -------------------------------------------------
      // Record transfer
      // -------------------------------------------------

      const transferResult = await client.query(
        `INSERT INTO transfers
        (
          from_base_id,
          to_base_id,
          equipment_type_id,
          quantity,
          transfer_date,
          reference_number,
          notes,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          fromBaseId,
          toBaseId,
          equipmentTypeId,
          quantity,
          transferDate,
          referenceNumber || null,
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
          "CREATE_TRANSFER",
          "transfer",
          transferResult.rows[0].id,
          JSON.stringify({
            fromBaseId,
            toBaseId,
            equipmentTypeId,
            quantity,
          }),
        ]
      );

      await client.query("COMMIT");

      res.status(201).json({
        message: "Transfer completed successfully",
        transfer: transferResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Transfer error:", error);

      res.status(500).json({
        message: "Failed to complete transfer",
      });
    } finally {
      client.release();
    }
  }
);

// =====================================================
// GET TRANSFER HISTORY
//
// Admin + Logistics Officer = all transfers
// Base Commander = transfers involving their base
// =====================================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT
        transfers.id,
        transfers.from_base_id,
        transfers.to_base_id,
        transfers.equipment_type_id,
        transfers.quantity,
        transfers.transfer_date,
        transfers.reference_number,
        transfers.notes,
        from_base.name AS from_base,
        to_base.name AS to_base,
        equipment_types.name AS equipment_type,
        users.name AS created_by
      FROM transfers
      JOIN bases AS from_base
        ON transfers.from_base_id = from_base.id
      JOIN bases AS to_base
        ON transfers.to_base_id = to_base.id
      JOIN equipment_types
        ON transfers.equipment_type_id = equipment_types.id
      JOIN users
        ON transfers.created_by = users.id
    `;

    const params = [];

    // -------------------------------------------------
    // Base Commander can only see transfers where
    // their assigned base is either the source or
    // destination.
    // -------------------------------------------------

    if (req.user.role === "Base Commander") {
      if (!req.user.baseId) {
        return res.status(403).json({
          message: "No base assigned to this user.",
        });
      }

      query += `
        WHERE transfers.from_base_id = $1
           OR transfers.to_base_id = $1
      `;

      params.push(req.user.baseId);
    }

    query += `
      ORDER BY transfers.transfer_date DESC,
               transfers.id DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching transfers:", error);

    res.status(500).json({
      message: "Failed to fetch transfers",
    });
  }
});

module.exports = router;