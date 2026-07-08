const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const User = require("../models/User");
const debugLog = path.resolve(__dirname, "../auth-debug.log");

const logDebug = (message, data) => {
  const payload = {
    timestamp: new Date().toISOString(),
    message,
    data,
  };

  try {
    fs.appendFileSync(debugLog, JSON.stringify(payload) + "\n");
  } catch (appendErr) {
    console.error("Failed to write auth debug log:", appendErr);
  }
};

const generateOTP = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

router.post("/request-otp", async (req, res) => {
  logDebug("request-otp received", { body: req.body });
  try {
    const { mobile } = req.body;

    if (!mobile || !mobile.trim()) {
      return res.status(400).json({
        error: "Mobile number is required",
      });
    }

    const normalizedMobile = mobile.trim();

    let user = await User.findOne({ mobile: normalizedMobile });

    if (!user) {
      user = await User.create({ mobile: normalizedMobile });
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = {
      code: otpCode,
      expiresAt,
    };

    await user.save();

    console.log(`OTP for ${normalizedMobile}: ${otpCode}`);

    res.json({
      success: true,
      message: "OTP sent to your mobile number",
      demoOtp: otpCode,
    });
  } catch (err) {
    logDebug("REQUEST OTP ERROR", {
      error: err,
      errorDetails: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
    });
    console.error("REQUEST OTP ERROR:", err);
    res.status(500).json({
      error: "Failed to request OTP",
      details: err?.message || String(err),
      rawError: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { mobile, code } = req.body;

    if (!mobile || !mobile.trim() || !code || !code.trim()) {
      return res.status(400).json({
        error: "Mobile and OTP code are required",
      });
    }

    const normalizedMobile = mobile.trim();

    const user = await User.findOne({ mobile: normalizedMobile });

    if (!user || !user.otp?.code) {
      return res.status(400).json({
        error: "Invalid mobile or OTP",
      });
    }

    if (user.otp.code !== String(code).trim()) {
      return res.status(400).json({
        error: "Incorrect OTP code",
      });
    }

    if (!user.otp.expiresAt || user.otp.expiresAt < new Date()) {
      return res.status(400).json({
        error: "OTP has expired",
      });
    }

    user.otp = {
      code: "",
      expiresAt: null,
    };

    await user.save();

    res.json({
      success: true,
      user: {
        id: user._id,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({
      error: "Failed to verify OTP",
    });
  }
});

module.exports = router;
