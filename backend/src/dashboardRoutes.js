const express = require("express");
const pool = require("./db");
const authenticateToken = require("./authMiddleware");

const router = express.Router();

function getDashboardAccess(req, res, requestedBaseId) {
  // Logistics Officers are limited to purchases and transfers.
  if (req.user.role === "Logistics Officer") {
    res.status(403).json({
      message: "You do not have permission to access the dashboard.",
    });
    return null;
  }

  // Admin can access all bases.
  if (req.user.role === "Admin") {
    return requestedBaseId || null;
  }

  // Base Commander must have an assigned base.
  if (req.user.role === "Base Commander") {
    if (!req.user.baseId) {
      res.status(403).json({
        message: "No base assigned to this user.",
      });
      return null;
    }

    // Ignore any different base ID supplied by the client.
    return Number(req.user.baseId);
  }

  res.status(403).json({
    message: "You do not have permission to access the dashboard.",
  });

  return null;
}


// ============================================================
// DASHBOARD SUMMARY
// ============================================================

router.get("/summary", authenticateToken, async (req, res) => {
  try {
    const {
      baseId: requestedBaseId,
      equipmentTypeId,
      startDate,
      endDate,
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "startDate and endDate are required",
      });
    }

    const baseId = getDashboardAccess(
      req,
      res,
      requestedBaseId
    );

    if (
      req.user.role !== "Admin" &&
      req.user.role !== "Base Commander"
    ) {
      return;
    }

    if (req.user.role === "Logistics Officer") {
      return;
    }

    async function calculateBalance(date) {
      // --------------------------------------------------------
      // Purchases
      // --------------------------------------------------------

      const purchaseValues = [date];
      const purchaseConditions = [
        "purchase_date <= $1",
      ];

      if (baseId) {
        purchaseValues.push(baseId);

        purchaseConditions.push(
          `base_id = $${purchaseValues.length}`
        );
      }

      if (equipmentTypeId) {
        purchaseValues.push(equipmentTypeId);

        purchaseConditions.push(
          `equipment_type_id = $${purchaseValues.length}`
        );
      }

      const purchaseResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM purchases
        WHERE ${purchaseConditions.join(" AND ")}
        `,
        purchaseValues
      );


      // --------------------------------------------------------
      // Transfer In
      // --------------------------------------------------------

      const transferInValues = [date];
      const transferInConditions = [
        "transfer_date <= $1",
      ];

      if (baseId) {
        transferInValues.push(baseId);

        transferInConditions.push(
          `to_base_id = $${transferInValues.length}`
        );
      }

      if (equipmentTypeId) {
        transferInValues.push(equipmentTypeId);

        transferInConditions.push(
          `equipment_type_id = $${transferInValues.length}`
        );
      }

      const transferInResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM transfers
        WHERE ${transferInConditions.join(" AND ")}
        `,
        transferInValues
      );


      // --------------------------------------------------------
      // Transfer Out
      // --------------------------------------------------------

      const transferOutValues = [date];
      const transferOutConditions = [
        "transfer_date <= $1",
      ];

      if (baseId) {
        transferOutValues.push(baseId);

        transferOutConditions.push(
          `from_base_id = $${transferOutValues.length}`
        );
      }

      if (equipmentTypeId) {
        transferOutValues.push(equipmentTypeId);

        transferOutConditions.push(
          `equipment_type_id = $${transferOutValues.length}`
        );
      }

      const transferOutResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM transfers
        WHERE ${transferOutConditions.join(" AND ")}
        `,
        transferOutValues
      );


      // --------------------------------------------------------
      // Expenditures
      // --------------------------------------------------------

      const expenditureValues = [date];
      const expenditureConditions = [
        "expenditure_date <= $1",
      ];

      if (baseId) {
        expenditureValues.push(baseId);

        expenditureConditions.push(
          `base_id = $${expenditureValues.length}`
        );
      }

      if (equipmentTypeId) {
        expenditureValues.push(equipmentTypeId);

        expenditureConditions.push(
          `equipment_type_id = $${expenditureValues.length}`
        );
      }

      const expenditureResult = await pool.query(
        `
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM expenditures
        WHERE ${expenditureConditions.join(" AND ")}
        `,
        expenditureValues
      );


      // --------------------------------------------------------
      // Assignments
      // --------------------------------------------------------

      const assignmentValues = [date];

      const assignmentConditions = [
        "assignments.assigned_date <= $1",
      ];

      if (baseId) {
        assignmentValues.push(baseId);

        assignmentConditions.push(
          `assets.base_id = $${assignmentValues.length}`
        );
      }

      if (equipmentTypeId) {
        assignmentValues.push(equipmentTypeId);

        assignmentConditions.push(
          `assets.equipment_type_id = $${assignmentValues.length}`
        );
      }

      const assignmentResult = await pool.query(
        `
        SELECT COALESCE(SUM(assignments.quantity), 0) AS total
        FROM assignments
        JOIN assets
          ON assignments.asset_id = assets.id
        WHERE ${assignmentConditions.join(" AND ")}
        `,
        assignmentValues
      );


      const purchases = Number(
        purchaseResult.rows[0].total
      );

      const transferIn = Number(
        transferInResult.rows[0].total
      );

      const transferOut = Number(
        transferOutResult.rows[0].total
      );

      const expenditures = Number(
        expenditureResult.rows[0].total
      );

      const assignments = Number(
        assignmentResult.rows[0].total
      );


      return (
        purchases +
        transferIn -
        transferOut -
        expenditures -
        assignments
      );
    }


    // ----------------------------------------------------------
    // Opening Balance
    // ----------------------------------------------------------

    const previousDay = new Date(
      `${startDate}T00:00:00`
    );

    previousDay.setDate(
      previousDay.getDate() - 1
    );

    const previousDate = previousDay
      .toISOString()
      .split("T")[0];

    const openingBalance =
      await calculateBalance(previousDate);


    // ----------------------------------------------------------
    // Closing Balance
    // ----------------------------------------------------------

    const closingBalance =
      await calculateBalance(endDate);


    // ----------------------------------------------------------
    // Assigned Assets During Selected Period
    // ----------------------------------------------------------

    const assignedValues = [
      startDate,
      endDate,
    ];

    const assignedConditions = [
      "assignments.assigned_date BETWEEN $1 AND $2",
    ];

    if (baseId) {
      assignedValues.push(baseId);

      assignedConditions.push(
        `assets.base_id = $${assignedValues.length}`
      );
    }

    if (equipmentTypeId) {
      assignedValues.push(equipmentTypeId);

      assignedConditions.push(
        `assets.equipment_type_id = $${assignedValues.length}`
      );
    }

    const assignedResult = await pool.query(
      `
      SELECT COALESCE(SUM(assignments.quantity), 0) AS total
      FROM assignments
      JOIN assets
        ON assignments.asset_id = assets.id
      WHERE ${assignedConditions.join(" AND ")}
      `,
      assignedValues
    );


    // ----------------------------------------------------------
    // Expended Assets During Selected Period
    // ----------------------------------------------------------

    const expenditureValues = [
      startDate,
      endDate,
    ];

    const expenditureConditions = [
      "expenditure_date BETWEEN $1 AND $2",
    ];

    if (baseId) {
      expenditureValues.push(baseId);

      expenditureConditions.push(
        `base_id = $${expenditureValues.length}`
      );
    }

    if (equipmentTypeId) {
      expenditureValues.push(equipmentTypeId);

      expenditureConditions.push(
        `equipment_type_id = $${expenditureValues.length}`
      );
    }

    const expenditureResult = await pool.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM expenditures
      WHERE ${expenditureConditions.join(" AND ")}
      `,
      expenditureValues
    );


    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    res.json({
      openingBalance,
      closingBalance,

      assignedAssets: Number(
        assignedResult.rows[0].total
      ),

      expendedAssets: Number(
        expenditureResult.rows[0].total
      ),
    });

  } catch (error) {
    console.error(
      "Dashboard summary error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to load dashboard summary",
    });
  }
});


// ============================================================
// DASHBOARD MOVEMENT
// ============================================================

router.get("/movement", authenticateToken, async (req, res) => {
  try {
    const {
      baseId: requestedBaseId,
      equipmentTypeId,
      startDate,
      endDate,
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message:
          "startDate and endDate are required",
      });
    }

    const baseId = getDashboardAccess(
      req,
      res,
      requestedBaseId
    );

    if (
      req.user.role !== "Admin" &&
      req.user.role !== "Base Commander"
    ) {
      return;
    }


    // ----------------------------------------------------------
    // Purchases
    // ----------------------------------------------------------

    const purchaseValues = [
      startDate,
      endDate,
    ];

    const purchaseConditions = [
      "purchase_date BETWEEN $1 AND $2",
    ];

    if (baseId) {
      purchaseValues.push(baseId);

      purchaseConditions.push(
        `base_id = $${purchaseValues.length}`
      );
    }

    if (equipmentTypeId) {
      purchaseValues.push(equipmentTypeId);

      purchaseConditions.push(
        `equipment_type_id = $${purchaseValues.length}`
      );
    }

    const purchaseResult = await pool.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM purchases
      WHERE ${purchaseConditions.join(" AND ")}
      `,
      purchaseValues
    );


    // ----------------------------------------------------------
    // Transfer In
    // ----------------------------------------------------------

    const transferInValues = [
      startDate,
      endDate,
    ];

    const transferInConditions = [
      "transfer_date BETWEEN $1 AND $2",
    ];

    if (baseId) {
      transferInValues.push(baseId);

      transferInConditions.push(
        `to_base_id = $${transferInValues.length}`
      );
    }

    if (equipmentTypeId) {
      transferInValues.push(equipmentTypeId);

      transferInConditions.push(
        `equipment_type_id = $${transferInValues.length}`
      );
    }

    const transferInResult = await pool.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM transfers
      WHERE ${transferInConditions.join(" AND ")}
      `,
      transferInValues
    );


    // ----------------------------------------------------------
    // Transfer Out
    // ----------------------------------------------------------

    const transferOutValues = [
      startDate,
      endDate,
    ];

    const transferOutConditions = [
      "transfer_date BETWEEN $1 AND $2",
    ];

    if (baseId) {
      transferOutValues.push(baseId);

      transferOutConditions.push(
        `from_base_id = $${transferOutValues.length}`
      );
    }

    if (equipmentTypeId) {
      transferOutValues.push(equipmentTypeId);

      transferOutConditions.push(
        `equipment_type_id = $${transferOutValues.length}`
      );
    }

    const transferOutResult = await pool.query(
      `
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM transfers
      WHERE ${transferOutConditions.join(" AND ")}
      `,
      transferOutValues
    );


    const purchases = Number(
      purchaseResult.rows[0].total
    );

    const transferIn = Number(
      transferInResult.rows[0].total
    );

    const transferOut = Number(
      transferOutResult.rows[0].total
    );


    res.json({
      purchases,
      transferIn,
      transferOut,

      netMovement:
        purchases +
        transferIn -
        transferOut,
    });

  } catch (error) {
    console.error(
      "Dashboard movement error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to calculate movement",
    });
  }
});


module.exports = router;