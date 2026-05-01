const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["income", "expense", "investment", "loan"],
    required: true,
  },

  subType: {
    type: String, // asset / liability (for loan)
    enum: ["asset", "liability", ""],
    default: "",
  },

  category: {
    type: String,
    default: "",
  },

  subCategory: {
    type: String,
    default: "",
  },

  // 👉 NEW: person (ledger system)
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Person",
    default: null,
  },

  amount: {
    type: Number,
    required: true,
  },

  note: {
    type: String,
    default: "",
  },

  date: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
