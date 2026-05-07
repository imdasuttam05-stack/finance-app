const mongoose = require("mongoose");

const transactionSchema =
  new mongoose.Schema({

    type: {
      type: String,

      enum: [
        "income",
        "expense",
        "investment",
        "loan",
        "payment",
        "received",
      ],

      required: true,
    },

    subType: {

      type: String,

      // asset / liability

      enum: [
        "asset",
        "liability",
        "",
      ],

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

    // =========================
    // PERSON / LEDGER
    // =========================
    personId: {

      type:
        mongoose.Schema.Types.ObjectId,

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

    // =========================
    // NEW DR CR
    // =========================
    drcr: {
      type: String,

      enum: ["DR", "CR"],

      default: "",
    },

    // =========================
    // RUNNING BALANCE
    // =========================
    balanceAfterEntry: {
      type: Number,
      default: 0,
    },

  },

  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "Transaction",
    transactionSchema
  );
