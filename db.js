require("dotenv").config(); // 👈 MUST

const mongoose = require("mongoose");

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ MONGODB_URI not found. Create Backend/.env from .env.example");
  process.exit(1);
}

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("DB Error:", err?.message || err);
    process.exit(1);
  });

module.exports = mongoose;
