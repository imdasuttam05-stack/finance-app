const express = require("express");
const router = express.Router();
const Person = require("../models/Person");
const { getPersonsByUser, isInMemoryMode } = require("../inMemoryStore");

// 📌 GET ALL LEDGERS
router.get("/", async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!isInMemoryMode()) {
      const data = await Person.find({ userId: req.userId }).sort({ name: 1 });
      return res.json(data);
    }

    const data = getPersonsByUser(req.userId);
    return res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load ledgers" });
  }
});

// 📌 CREATE LEDGER
router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const mobile = String(req.body?.mobile || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Ledger name required" });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const exists = await Person.findOne({ userId: req.userId, name });
    if (exists) {
      return res.status(400).json({ error: "Ledger already exists" });
    }

    const person = await Person.create({ userId: req.userId, name, mobile });
    res.json(person);

  } catch (err) {
    res.status(500).json({ error: "Failed to create ledger" });
  }
});

module.exports = router;
