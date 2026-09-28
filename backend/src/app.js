const baseRoutes = require("./baseRoutes");
const equipmentTypeRoutes = require("./equipmentTypeRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const assignmentRoutes = require("./assignmentRoutes");
const expenditureRoutes = require("./expenditureRoutes");
const transferRoutes = require("./transferRoutes");
const purchaseRoutes = require("./purchaseRoutes");
const assetRoutes = require("./assetRoutes");
const auditRoutes = require("./auditRoutes");

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./authRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Military Asset Management API is running",
  });
});

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(
      "Database connection error:",
      error
    );

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

const PORT = 5000;

app.use("/api/auth", authRoutes);

app.use("/api/assets", assetRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/expenditures", expenditureRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bases", baseRoutes);
app.use("/api/equipment-types", equipmentTypeRoutes);
app.use("/api/audit-logs", auditRoutes);

app.listen(PORT, () => {
  console.log(
    `Backend running on http://localhost:${PORT}`
  );
});