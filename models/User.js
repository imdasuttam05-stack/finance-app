const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    unique: true,
  },
  otp: {
    code: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("User", UserSchema);
