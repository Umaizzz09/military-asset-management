const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        description
      FROM equipment_types
      ORDER BY id
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Equipment types error:", error);

    res.status(500).json({
      message: "Failed to load equipment types"
    });
  }
});

module.exports = router;