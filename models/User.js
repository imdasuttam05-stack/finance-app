const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    sparse: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    minlength: 6,
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
  isRegistered: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Hash password before saving
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate unique user ID
UserSchema.methods.generateUserId = function() {
  if (!this.userId) {
    this.userId = `USR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  return this.userId;
};

module.exports = mongoose.model("User", UserSchema);
