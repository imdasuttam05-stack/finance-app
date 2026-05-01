const express = require("express");
const router = express.Router();
const Person = require("../models/Person");

// 📌 GET ALL LEDGERS
router.get("/", async (req, res) => {
  try {
    const data = await Person.find().sort({ name: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load ledgers" });
  }
});

// 📌 CREATE LEDGER
router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Ledger name required" });
    }

    const exists = await Person.findOne({ name });
    if (exists) {
      return res.status(400).json({ error: "Ledger already exists" });
    }

    const person = await Person.create({ name });
    res.json(person);

  } catch (err) {
    res.status(500).json({ error: "Failed to create ledger" });
  }
});

module.exports = router;