const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");

// =====================================
// ➕ ADD TRANSACTION
// =====================================
router.post("/", async (req, res) => {
  try {

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      personId,
      type,
      subType,
      amount,
      againstId,
    } = req.body;

    const normalizedAgainstId =
      againstId && String(againstId).trim()
        ? againstId
        : null;

    if (
      ["loan", "investment", "payment", "received"].includes(type) &&
      !personId
    ) {
      return res.status(400).json({
        error: "Ledger selection is required for this transaction type",
      });
    }

    // =========================
    // PREVIOUS LEDGER BALANCE
    // =========================
    const oldTransactions =
      await Transaction.find({
        userId: req.userId,
        personId,
      });

    let drTotal = 0;
    let crTotal = 0;

    oldTransactions.forEach((t) => {

      if (t.drcr === "DR") {
        drTotal += Number(t.amount || 0);
      }

      else if (t.drcr === "CR") {
        crTotal += Number(t.amount || 0);
      }

    });

    let runningBalance =
      drTotal - crTotal;

    // =========================
    // AUTO DR CR
    // =========================
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
      drcr = subType === "liability" ? "CR" : "DR";
    }

    // =========================
    // SAVE TRANSACTION
    // =========================
    const data =
      await Transaction.create({

        ...req.body,
        userId: req.userId,
        againstId: normalizedAgainstId,

        drcr,

        balanceAfterEntry:
          runningBalance,

      });

    if (normalizedAgainstId) {
      const targetTransaction = await Transaction.findOne({
        _id: normalizedAgainstId,
        userId: req.userId,
      });

      if (!targetTransaction) {
        return res.status(404).json({
          error: "Selected entry not found",
        });
      }

      if (targetTransaction.againstId) {
        return res.status(400).json({
          error: "This entry has already been linked to another transaction",
        });
      }

      await Transaction.findByIdAndUpdate(normalizedAgainstId, {
        againstId: data._id,
      });
    }

    res.json(data);

  } catch (err) {

    console.log(err);

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

// =====================================
// 📄 GET ALL TRANSACTIONS
// =====================================
router.get("/", async (req, res) => {
  try {

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data =
      await Transaction.find({ userId: req.userId })
        .populate("personId")
        .sort({ date: -1 });

    res.json(data);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error:
        "Failed to fetch transactions",
    });

  }
});

// =====================================
// 📒 PERSON LEDGER
// =====================================
router.get(
  "/ledger/:personId",
  async (req, res) => {

    try {

      const data =
        await Transaction.find({
          userId: req.userId,
          personId:
            req.params.personId,
        })
          .populate("personId")
          .populate("againstId")
          .sort({ date: -1 });

      res.json(data);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:
          "Ledger fetch failed",
      });

    }

  }
);

// =====================================
// 📊 LEDGER BALANCE
// =====================================
router.get(
  "/ledger-balance/:personId",
  async (req, res) => {

    try {

      const transactions =
        await Transaction.find({
          userId: req.userId,
          personId:
            req.params.personId,
        });

      let drTotal = 0;
      let crTotal = 0;

      transactions.forEach((t) => {

        if (t.drcr === "DR") {
          drTotal +=
            Number(t.amount || 0);
        }

        else if (t.drcr === "CR") {
          crTotal +=
            Number(t.amount || 0);
        }

      });

      const balance =
        drTotal - crTotal;

      res.json({

        balance:
          Math.abs(balance),

        type:
          balance >= 0
            ? "DR"
            : "CR",

      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:
          "Balance fetch failed",
      });

    }

  }
);

// =====================================
// 📊 SUMMARY
// =====================================
router.get("/summary", async (req, res) => {

  try {

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data =
      await Transaction.find({ userId: req.userId });

    let summary = {

      income: 0,
      expense: 0,
      investment: 0,
      asset: 0,
      liability: 0,

    };

    data.forEach((t) => {

      const amount =
        Number(t.amount || 0);

      if (t.type === "income") {
        summary.income += amount;
      }

      if (t.type === "expense") {
        summary.expense += amount;
      }

      if (t.type === "investment") {
        summary.investment += amount;
      }

      if (t.type === "loan") {

        if (t.subType === "asset") {
          summary.asset += amount;
        }

        if (t.subType === "liability") {
          summary.liability += amount;
        }

      }

    });

    res.json(summary);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error:
        "Summary failed",
    });

  }

});

// =====================================
// 📊 CATEGORY SUMMARY
// =====================================
router.get(
  "/category-summary",
  async (req, res) => {

    try {

if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data =
      await Transaction.find({
        userId: req.userId,
          type: "expense",
        });

      const result = {};

      data.forEach((t) => {

        const key =
          `${t.category} - ${t.subCategory}`;

        if (!result[key]) {
          result[key] = 0;
        }

        result[key] +=
          Number(t.amount || 0);

      });

      res.json(result);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        error:
          "Category summary failed",
      });

    }

  }
);

module.exports = router;
