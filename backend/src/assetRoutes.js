const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    // Logistics Officers are limited to purchases and transfers.
    if (req.user.role === "Logistics Officer") {
      return res.status(403).json({
        message:
          "You do not have permission to access assets.",
      });
    }

    let query = `
      SELECT
        assets.id,
        assets.asset_code,
        assets.base_id,
        assets.equipment_type_id,
        assets.quantity,
        assets.status,
        bases.name AS base_name,
        equipment_types.name AS equipment_type
      FROM assets
      JOIN bases
        ON assets.base_id = bases.id
      JOIN equipment_types
        ON assets.equipment_type_id = equipment_types.id
    `;

    const params = [];

    // Base Commander can only see assets
    // belonging to their assigned base.
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

    query += `
      ORDER BY
        bases.name,
        equipment_types.name
    `;

    const result = await pool.query(
      query,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Error fetching assets:",
      error
    );

    res.status(500).json({
      message: "Failed to fetch assets",
    });
  }
});

module.exports = router;