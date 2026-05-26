const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");

// =====================================
// ➕ ADD TRANSACTION
// =====================================
router.post("/", async (req, res) => {
  try {

    const {
      personId,
      type,
      amount,
    } = req.body;

    // =========================
    // PREVIOUS LEDGER BALANCE
    // =========================
    const oldTransactions =
      await Transaction.find({
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

    // =========================
    // SAVE TRANSACTION
    // =========================
    const data =
      await Transaction.create({

        ...req.body,

        drcr,

        balanceAfterEntry:
          runningBalance,

      });

    res.json(data);

  } catch (err) {

    console.log(err);

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

    const data =
      await Transaction.find()
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
          personId:
            req.params.personId,
        })
          .populate("personId")
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

    const data =
      await Transaction.find();

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

      const data =
        await Transaction.find({
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
