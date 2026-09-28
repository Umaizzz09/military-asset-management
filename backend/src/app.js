require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./authRoutes");

const baseRoutes = require("./baseRoutes");
const equipmentTypeRoutes = require("./equipmentTypeRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const assignmentRoutes = require("./assignmentRoutes");
const expenditureRoutes = require("./expenditureRoutes");
const transferRoutes = require("./transferRoutes");
const purchaseRoutes = require("./purchaseRoutes");
const assetRoutes = require("./assetRoutes");
const auditRoutes = require("./auditRoutes");

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.length === 0) {
        return callback(null, true);
      }

      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Military Asset Management API is running",
    status: "online",
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
    console.error("Database connection error:", error);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

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

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  if (err.message === "CORS origin not allowed") {
    return res.status(403).json({
      message: "CORS origin not allowed",
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
});

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on 0.0.0.0:${PORT}`);
});