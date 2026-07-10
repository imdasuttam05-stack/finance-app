const express = require("express");
const fs = require("fs");
const path = require("path");
const twilio = require("twilio");
const router = express.Router();

const User = require("../models/User");
const debugLog = path.resolve(__dirname, "../auth-debug.log");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER
  ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

const sendOtpSms = async (to, otpCode) => {
  if (!twilioClient || !TWILIO_FROM_NUMBER) {
    throw new Error("Twilio SMS is not configured.");
  }

  return twilioClient.messages.create({
    body: `Your OTP is ${otpCode}. It expires in 5 minutes.`,
    from: TWILIO_FROM_NUMBER,
    to,
  });
};

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

// Request OTP for registration or login
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

    let smsSent = false;
    let smsError = null;
    const smsConfigured = Boolean(twilioClient && TWILIO_FROM_NUMBER);

    try {
      if (smsConfigured) {
        await sendOtpSms(normalizedMobile, otpCode);
        smsSent = true;
      } else {
        console.warn("Twilio SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.");
      }
    } catch (sendErr) {
      smsError = sendErr;
      console.error("OTP SMS send error:", sendErr);
    }

    console.log(`OTP for ${normalizedMobile}: ${otpCode} (smsSent=${smsSent}, smsConfigured=${smsConfigured})`);

    const includeDemoOtp = process.env.NODE_ENV !== "production" || process.env.DEBUG_OTP === "true" || !smsConfigured;
    const response = {
      success: true,
      message: smsSent
        ? "OTP sent to your mobile number"
        : smsConfigured
          ? "OTP generated but SMS could not be delivered."
          : "OTP generated. SMS provider is not configured, so use the demo OTP below.",
      isNewUser: !user.isRegistered,
      smsConfigured,
    };

    if (includeDemoOtp) {
      response.demoOtp = otpCode;
    }

    if (!smsSent && smsError) {
      response.smsError = smsError.message;
    }

    res.json(response);
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

// Verify OTP and either register new user or login existing user
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
      isNewUser: !user.isRegistered,
      user: {
        id: user._id,
        userId: user.userId || null,
        mobile: user.mobile,
        email: user.email || null,
        username: user.username || null,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({
      error: "Failed to verify OTP",
    });
  }
});

// Register new user with username, email, and password
router.post("/register", async (req, res) => {
  try {
    const { mobile, username, email, password } = req.body;

    if (!mobile || !username || !email || !password) {
      return res.status(400).json({
        error: "Mobile, username, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    const normalizedMobile = mobile.trim();
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });

    if (existingUser) {
      if (existingUser.username === normalizedUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    let user = await User.findOne({ mobile: normalizedMobile });

    if (!user) {
      return res.status(400).json({
        error: "Mobile not verified. Please verify OTP first.",
      });
    }

    user.username = normalizedUsername;
    user.email = normalizedEmail;
    user.password = password;
    user.isRegistered = true;

    if (!user.userId) {
      user.generateUserId();
    }

    await user.save();

    res.json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({
      error: "Registration failed",
      details: err?.message || String(err),
    });
  }
});

// Login with username/email and password
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username/Email and password are required",
      });
    }

    const user = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: username.trim().toLowerCase() },
      ],
      isRegistered: true,
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      error: "Login failed",
      details: err?.message || String(err),
    });
  }
});

module.exports = router;
