const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["income", "expense", "investment", "loan"],
  },
  subType: {
    type: String, // asset / liability (for loan)
  },
  amount: Number,
  note: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);