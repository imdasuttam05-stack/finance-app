const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// 🔹 Models
const Transaction = require("./models/Transaction");

// ==========================
// ✅ Middleware
// ==========================
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://your-vercel-app.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());

// 🔥 SAFE TYPE CONVERTER MIDDLEWARE
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
// 💰 CREATE TRANSACTION
// ==========================
app.post("/api/transactions", async (req, res) => {
  try {
    const transaction = await Transaction.create({
      type: req.body.type,
      category: req.body.category || "",
      subCategory: req.body.subCategory || "",
      subType: req.body.subType || "",
      amount: req.body.amount || 0,
      note: req.body.note || "",
      date: req.body.date || new Date(),
      personId: req.body.personId || req.body.person || null,
    });

    res.json(transaction);
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: "Failed to save transaction" });
  }
});

// ==========================
// 📊 GET ALL TRANSACTIONS
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
// 📄 SINGLE TRANSACTION
// ==========================
app.get("/api/transactions/:id", async (req, res) => {
  try {
    const t = await Transaction.findById(req.params.id).populate("personId");
    res.json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

// ==========================
// ✏️ UPDATE TRANSACTION
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
// 📒 LEDGER (IMPORTANT FIXED)
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
// 📊 SUMMARY (IMPROVED SAFE)
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
    console.error(err);
    res.status(500).json({ error: "Summary failed" });
  }
});

// ==========================
// 📊 CATEGORY SUMMARY
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
    console.error(err);
    res.status(500).json({ error: "Category summary failed" });
  }
});

// ==========================
// 📅 MONTHLY REPORT (FIXED SAFE)
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
// 🚀 START SERVER
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
