const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================
// ✅ DB CONNECT
// ==========================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ DB Error:", err));

// ==========================
// ✅ MODELS
// ==========================
const Transaction = require("./models/Transaction");

// ==========================
// ✅ MIDDLEWARE
// ==========================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://finance-app-frontend-blush.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());

// SAFE TYPE FIX
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

// ==========================
// 📊 SUMMARY (IMPORTANT: UP)
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
    res.status(500).json({ error: "Summary failed" });
  }
});

// ==========================
// 📊 CATEGORY SUMMARY (UP)
// ==========================
app.get("/api/transactions/category-summary", async (req, res) => {
  try {
    const list = await Transaction.find({ type: "expense" });

    const map = {};

    list.forEach((t) => {
      const key = t.category || "others";
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    });

    res.json(map);
  } catch (err) {
    console.error("CATEGORY ERROR:", err);
    res.status(500).json({ error: "Category summary failed" });
  }
});

// ==========================
// 💰 CREATE
// ==========================
app.post("/api/transactions", async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body
    });

    res.json(transaction);
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: "Failed to save transaction" });
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
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ==========================
// 📄 SINGLE (IMPORTANT: LAST)
// ==========================
app.get("/api/transactions/:id", async (req, res) => {
  try {
    const t = await Transaction.findById(req.params.id).populate("personId");

    if (!t) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(t);
  } catch (err) {
    console.error("ID ERROR:", err);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

// ==========================
// ✏️ UPDATE
// ==========================
app.put("/api/transactions/:id", async (req, res) => {
  try {
    const t = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ==========================
// 📒 LEDGER
// ==========================
app.get("/api/ledger/:personId", async (req, res) => {
  try {
    const data = await Transaction.find({
      personId: req.params.personId,
    })
      .populate("personId")
      .sort({ date: -1 });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ledger load failed" });
  }
});

// ==========================
// 📅 MONTHLY
// ==========================
app.get("/api/transactions/monthly", async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: "Month required (YYYY-MM)" });
    }

    const start = new Date(`${month}-01`);
    const end = new Date(`${month}-31`);

    const list = await Transaction.find({
      date: { $gte: start, $lte: end },
    });

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Monthly report failed" });
  }
});

// ==========================
// 🩺 HEALTH CHECK
// ==========================
app.get("/", (req, res) => {
  res.send("✅ API running...");
});

// ==========================
// 🚀 START
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
