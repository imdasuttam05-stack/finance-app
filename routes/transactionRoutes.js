const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

// Add Transaction
router.post("/", async (req, res) => {
  const data = await Transaction.create(req.body);
  res.json(data);
});

// Get All
router.get("/", async (req, res) => {
  const data = await Transaction.find().sort({ date: -1 });
  res.json(data);
});

// Summary
router.get("/summary", async (req, res) => {
  const data = await Transaction.find();

  let summary = {
    income: 0,
    expense: 0,
    investment: 0,
    asset: 0,
    liability: 0,
  };

  data.forEach((t) => {
    if (t.type === "income") summary.income += t.amount;
    if (t.type === "expense") summary.expense += t.amount;
    if (t.type === "investment") summary.investment += t.amount;

    if (t.type === "loan") {
      if (t.subType === "asset") summary.asset += t.amount;
      if (t.subType === "liability") summary.liability += t.amount;
    }
  });

  res.json(summary);
});

// Category Summary
router.get("/category-summary", async (req, res) => {
  const data = await Transaction.find({ type: "expense" });

  const result = {};

  data.forEach((t) => {
    const key = `${t.category} - ${t.subCategory}`;

    if (!result[key]) result[key] = 0;
    result[key] += t.amount;
  });

  res.json(result);
});

module.exports = router;
