const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["income", "expense", "investment", "loan", "payment", "received"],
    required: true,
  },
  subType: {
    type: String,
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
  drcr: {
    type: String,
    enum: ["DR", "CR"],
    default: "",
  },
  balanceAfterEntry: {
    type: Number,
    default: 0,
  },
  againstId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Transaction", transactionSchema);
