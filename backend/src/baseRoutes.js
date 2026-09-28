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
        location
      FROM bases
      ORDER BY id
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Bases error:", error);

    res.status(500).json({
      message: "Failed to load bases"
    });
  }
});

module.exports = router;