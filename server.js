const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================
// ✅ DB CONNECT
// ==========================
const rawMongoUri = process.env.MONGODB_URI?.trim();

if (!rawMongoUri || ["undefined", "null"].includes(rawMongoUri.toLowerCase())) {
  console.error("❌ MONGODB_URI is not configured. Set MONGODB_URI to your MongoDB Atlas connection string.");
  process.exit(1);
}

const mongoUri = rawMongoUri;
console.log(`MongoDB URI source: env`);

mongoose.connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB Connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB Error:", err);
    process.exit(1);
  });

// ==========================
// ✅ MODELS
// ==========================
const Transaction = require("./models/Transaction");
const transactionRoutes = require("./routes/transactionRoutes");

// ==========================
// ✅ MIDDLEWARE
// ==========================
const defaultOrigins = [
  "http://localhost:3000",
  "https://finance-app-frontend-blush.vercel.app",
];

const envOrigins = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-admin-secret"],
  })
);

app.use(express.json());

app.use((req, res, next) => {
  req.userId = req.get("x-user-id") || req.headers["x-user-id"] || "";
  next();
});

// REQUEST LOGGING
app.use((req, res, next) => {
  console.log("REQ", req.method, req.originalUrl, JSON.stringify(req.body));
  next();
});

// SAFE NUMBER FIX
app.use((req, res, next) => {
  if (req.body?.amount !== undefined) {
    req.body.amount = Number(req.body.amount || 0);
  }

  next();
});

// ==========================
// 📒 ROUTES
// ==========================
app.use("/api/persons", require("./routes/personRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", transactionRoutes);

// ==========================
// 📊 SUMMARY
// ==========================
app.get("/api/transactions/summary", async (req, res) => {
  try {
    const list = await Transaction.find();

    const sum = {
      income: 0,
      expense: 0,
      investment: 0,
      asset: 0,
      liability: 0,
    };

    list.forEach((t) => {
      const amount = Number(t.amount || 0);

      if (t.type === "income") sum.income += amount;
      if (t.type === "expense") sum.expense += amount;
      if (t.type === "investment") sum.investment += amount;

      if (t.subType === "asset") sum.asset += amount;
      if (t.subType === "liability") sum.liability += amount;
    });

    res.json(sum);
  } catch (err) {
    console.error("SUMMARY ERROR:", err);

    res.status(500).json({
      error: "Summary failed",
    });
  }
});

// ==========================
// 📊 CATEGORY SUMMARY
// ==========================
app.get(
  "/api/transactions/category-summary",
  async (req, res) => {
    try {
      const list = await Transaction.find({
        type: "expense",
      });

      const map = {};

      list.forEach((t) => {
        const key = t.category || "others";

        map[key] =
          (map[key] || 0) +
          Number(t.amount || 0);
      });

      res.json(map);
    } catch (err) {
      console.error("CATEGORY ERROR:", err);

      res.status(500).json({
        error: "Category summary failed",
      });
    }
  }
);

// ==========================
// 📒 LEDGER BALANCE
// ==========================
app.get(
  "/api/ledger-balance/:personId",
  async (req, res) => {
    try {
      const transactions =
        await Transaction.find({
          personId: req.params.personId,
        });

      let drTotal = 0;
      let crTotal = 0;

      transactions.forEach((t) => {
        if (t.drcr === "DR") {
          drTotal += Number(t.amount || 0);
        } else if (t.drcr === "CR") {
          crTotal += Number(t.amount || 0);
        }
      });

      const balance = drTotal - crTotal;

      res.json({
        balance: Math.abs(balance),
        type: balance >= 0 ? "DR" : "CR",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Balance failed",
      });
    }
  }
);

// ==========================
// 💰 CREATE TRANSACTION
// ==========================
app.post("/api/transactions", async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      personId,
      type,
      amount,
    } = req.body;

    if (
      ["loan", "investment", "payment", "received"].includes(type) &&
      !personId
    ) {
      return res.status(400).json({
        error: "Ledger selection is required for this transaction type",
      });
    }

    // ======================
    // OLD LEDGER BALANCE
    // ======================
    const oldTransactions =
      await Transaction.find({
        personId,
      });

    let drTotal = 0;
    let crTotal = 0;

    oldTransactions.forEach((t) => {
      if (t.drcr === "DR") {
        drTotal += Number(t.amount || 0);
      } else if (t.drcr === "CR") {
        crTotal += Number(t.amount || 0);
      }
    });

    let runningBalance =
      drTotal - crTotal;

    // ======================
    // AUTO DR CR
    // ======================
    let drcr = "";

    // PAYMENT / EXPENSE
    if (
      type === "expense" ||
      type === "payment"
    ) {
      drcr = "DR";

      runningBalance =
        runningBalance +
        Number(amount || 0);
    }

    // RECEIVED / INCOME
    else if (
      type === "income" ||
      type === "received"
    ) {
      drcr = "CR";

      runningBalance =
        runningBalance -
        Number(amount || 0);
    }

    // LOAN / INVESTMENT
    else if (
      type === "loan" ||
      type === "investment"
    ) {
      drcr = req.body.subType === "liability" ? "CR" : "DR";
    }

    // ======================
    // SAVE
    // ======================
    const transaction =
      await Transaction.create({
        ...req.body,
        userId: req.userId,
        drcr,

        balanceAfterEntry:
          runningBalance,
      });

    res.json(transaction);
  } catch (err) {
    console.error("CREATE ERROR:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }

    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid identifier provided" });
    }

    res.status(500).json({
      error:
        "Failed to save transaction",
    });
  }
});

// ==========================
// 📊 GET ALL
// ==========================
app.get("/api/transactions", async (req, res) => {
  try {
    const list = await Transaction.find()
      .populate("personId")
      .sort({ date: -1 });

    res.json(list);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        "Failed to fetch transactions",
    });
  }
});

// ==========================
// 📄 SINGLE
// ==========================
app.get(
  "/api/transactions/:id",
  async (req, res) => {
    try {
      const t =
        await Transaction.findById(
          req.params.id
        ).populate("personId");

      if (!t) {
        return res.status(404).json({
          error: "Not found",
        });
      }

      res.json(t);
    } catch (err) {
      console.error("ID ERROR:", err);

      res.status(500).json({
        error:
          "Failed to fetch transaction",
      });
    }
  }
);

// ==========================
// ✏️ UPDATE
// ==========================
app.put(
  "/api/transactions/:id",
  async (req, res) => {
    try {
      const existing = await Transaction.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({
          error: "Transaction not found",
        });
      }

      const incomingAgainstId =
        req.body.againstId && String(req.body.againstId).trim()
          ? req.body.againstId
          : null;

      if (
        existing.againstId &&
        existing.againstId.toString() !== incomingAgainstId?.toString()
      ) {
        await Transaction.findByIdAndUpdate(existing.againstId, {
          againstId: null,
        });
      }

      if (incomingAgainstId) {
        const target = await Transaction.findById(incomingAgainstId);

        if (!target) {
          return res.status(404).json({
            error: "Selected entry not found",
          });
        }

        if (target._id.toString() === existing._id.toString()) {
          return res.status(400).json({
            error: "You cannot link an entry to itself",
          });
        }

        if (
          target.againstId &&
          target.againstId.toString() !== existing._id.toString()
        ) {
          return res.status(400).json({
            error: "This entry has already been linked to another transaction",
          });
        }

        await Transaction.findByIdAndUpdate(incomingAgainstId, {
          againstId: existing._id,
        });
      }

      const t = await Transaction.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          againstId: incomingAgainstId,
        },
        {
          new: true,
        }
      );

      res.json(t);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Update failed",
      });
    }
  }
);

// ==========================
// ❌ DELETE
// ==========================
app.delete(
  "/api/transactions/:id",
  async (req, res) => {
    try {
      const existing = await Transaction.findById(req.params.id);

      if (existing?.againstId) {
        await Transaction.findByIdAndUpdate(existing.againstId, {
          againstId: null,
        });
      }

      const referencing = await Transaction.findOne({
        againstId: req.params.id,
      });

      if (referencing) {
        await Transaction.findByIdAndUpdate(referencing._id, {
          againstId: null,
        });
      }

      await Transaction.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Delete failed",
      });
    }
  }
);

// ==========================
// 📒 PERSON LEDGER
// ==========================
app.get(
  "/api/ledger/:personId",
  async (req, res) => {
    try {
      const data =
        await Transaction.find({
          personId: req.params.personId,
        })
          .populate("personId")
          .sort({ date: -1 });

      res.json(data);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Ledger load failed",
      });
    }
  }
);

// ==========================
// 📅 MONTHLY
// ==========================
app.get(
  "/api/transactions/monthly",
  async (req, res) => {
    try {
      const { month } = req.query;

      if (!month) {
        return res.status(400).json({
          error:
            "Month required (YYYY-MM)",
        });
      }

      const start =
        new Date(`${month}-01`);

      const end =
        new Date(`${month}-31`);

      const list =
        await Transaction.find({
          date: {
            $gte: start,
            $lte: end,
          },
        });

      res.json(list);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Monthly report failed",
      });
    }
  }
);

// ==========================
// 🩺 HEALTH CHECK
// ==========================
app.get("/", (req, res) => {
  res.send("✅ API running...");
});
