const express = require("express");
const fs = require("fs");
const path = require("path");
const twilio = require("twilio");
const router = express.Router();

const User = require("../models/User");
const { authenticateUser, getUserByUserId, isInMemoryMode } = require("../inMemoryStore");
const debugLog = path.resolve(__dirname, "../auth-debug.log");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

const twilioClient = (() => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return null;
  }

  try {
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn("Twilio initialization failed:", err?.message || err);
    return null;
  }
})();

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

const isAdminCredentialLogin = (username, password) => {
  const defaultAdminUsername = "admin";
  const defaultAdminPassword = "Admin@1234";
  const adminUsername = (process.env.ADMIN_USERNAME || defaultAdminUsername).trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || defaultAdminPassword).trim();
  const normalizedUsername = (username || "").trim().toLowerCase();
  const normalizedPassword = (password || "").trim();
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

  return Boolean(
    adminUsername &&
    adminPassword &&
    normalizedUsername &&
    normalizedPassword &&
    (normalizedUsername === adminUsername.toLowerCase() || normalizedUsername === adminEmail) &&
    normalizedPassword === adminPassword
  );
};

const isAdminRequest = async (req) => {
  const requesterUserId = req.headers["x-user-id"];
  if (!requesterUserId) {
    return false;
  }

  const requester = await User.findOne({ userId: requesterUserId });
  return Boolean(requester?.isAdmin);
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
    user.isApproved = false;

    if (!user.userId) {
      user.generateUserId();
    }

    await user.save();

    res.json({
      success: true,
      message: "Registration successful. Your account is now pending approval.",
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        isApproved: user.isApproved,
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

    const incomingUsername = username.trim();
    const incomingPassword = password.trim();

    if (isInMemoryMode()) {
      const user = authenticateUser({ username: incomingUsername, password: incomingPassword });

      if (!user) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      return res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user._id,
          userId: user.userId,
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          isApproved: user.isApproved,
          isAdmin: user.isAdmin || false,
          role: user.role || "user",
        },
      });
    }

    if (isAdminCredentialLogin(incomingUsername, incomingPassword)) {
      const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim();
      const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
      const adminPassword = (process.env.ADMIN_PASSWORD || "Admin@1234").trim();

      let adminUser = await User.findOne({
        $or: [{ username: adminUsername }, { email: adminEmail || `${adminUsername.toLowerCase()}@finance.local` }],
      });

      if (!adminUser) {
        const mobile = `ADMIN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        adminUser = new User({
          mobile,
          username: adminUsername,
          email: adminEmail || `${adminUsername.toLowerCase()}@finance.local`,
          password: adminPassword,
          isRegistered: true,
          isApproved: true,
          isAdmin: true,
        });

        // Ensure admin user has a generated userId so client can send x-user-id for auth
        adminUser.generateUserId();
        await adminUser.save();
      } else {
        adminUser.username = adminUsername;
        adminUser.email = adminEmail || `${adminUsername.toLowerCase()}@finance.local`;
        adminUser.password = adminPassword;
        adminUser.isRegistered = true;
        adminUser.isApproved = true;
        adminUser.isAdmin = true;

        if (!adminUser.userId) {
          adminUser.generateUserId();
        }

        await adminUser.save();
      }

      return res.json({
        success: true,
        message: "Admin login successful",
        user: {
          id: adminUser._id,
          userId: adminUser.userId,
          username: adminUser.username,
          email: adminUser.email,
          mobile: adminUser.mobile,
          isApproved: adminUser.isApproved,
          isAdmin: true,
          role: "admin",
        },
      });
    }

    const user = await User.findOne({
      $or: [
        { username: incomingUsername },
        { email: incomingUsername.toLowerCase() },
      ],
      isRegistered: true,
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    if (!user.isApproved) {
      return res.status(403).json({
        error: "Your account is awaiting approval.",
      });
    }

    const isPasswordValid = await user.comparePassword(incomingPassword);

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
        isApproved: user.isApproved,
        isAdmin: user.isAdmin || false,
        role: user.isAdmin ? "admin" : "user",
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

// Get current user (based on x-user-id header)
router.get("/me", async (req, res) => {
  try {
    const requesterUserId = req.headers["x-user-id"] || req.query.userId || req.userId;
    if (!requesterUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (isInMemoryMode()) {
      const user = getUserByUserId(requesterUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        success: true,
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          isApproved: user.isApproved,
          isAdmin: user.isAdmin || false,
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
        },
      });
    }

    const user = await User.findOne({ userId: requesterUserId }).select("userId username email mobile isApproved isAdmin createdAt updatedAt");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

// Update profile for current user
router.put("/update-profile", async (req, res) => {
  try {
    const requesterUserId = req.headers["x-user-id"] || req.userId;
    if (!requesterUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { username, email, mobile, password } = req.body;

    const user = await User.findOne({ userId: requesterUserId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (username) user.username = username.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (mobile) user.mobile = mobile.trim();
    if (password) user.password = password; // will be hashed by pre-save hook

    await user.save();

    res.json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        isApproved: user.isApproved,
      },
    });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ error: "Failed to update profile", details: err?.message || String(err) });
  }
});

// Admin endpoint: get pending approval users
router.get("/pending-users", async (req, res) => {
  try {
    const secret = req.query.secret || req.headers["x-admin-secret"];
    const isAuthorizedAdmin = secret === ADMIN_SECRET || (await isAdminRequest(req));

    if (!ADMIN_SECRET && !(await isAdminRequest(req))) {
      return res.status(500).json({
        error: "Admin approval is not configured. Set ADMIN_SECRET in environment."
      });
    }

    if (!isAuthorizedAdmin) {
      return res.status(401).json({
        error: "Unauthorized request"
      });
    }

    const users = await User.find({
      isRegistered: true,
      isApproved: false,
    })
      .select("userId username email mobile createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch (err) {
    console.error("PENDING USERS ERROR:", err);
    res.status(500).json({
      error: "Failed to load pending users",
      details: err?.message || String(err),
    });
  }
});

// Admin endpoint: approve a registered user
router.post("/approve-user", async (req, res) => {
  try {
    const { userId, secret } = req.body;
    const isAuthorizedAdmin = secret === ADMIN_SECRET || (await isAdminRequest(req));

    if (!ADMIN_SECRET && !(await isAdminRequest(req))) {
      return res.status(500).json({
        error: "Admin approval is not configured. Set ADMIN_SECRET in environment."
      });
    }

    if (!isAuthorizedAdmin) {
      return res.status(401).json({
        error: "Unauthorized approval request"
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: "userId is required"
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    user.isApproved = true;
    await user.save();

    res.json({
      success: true,
      message: "User approved successfully",
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        isApproved: user.isApproved,
      },
    });
  } catch (err) {
    console.error("APPROVAL ERROR:", err);
    res.status(500).json({
      error: "Approval failed",
      details: err?.message || String(err),
    });
  }
});

// Admin endpoint: reject a registered user (mark as not registered / not approved)
router.post("/reject-user", async (req, res) => {
  try {
    const { userId, secret } = req.body;
    const isAuthorizedAdmin = secret === ADMIN_SECRET || (await isAdminRequest(req));

    if (!ADMIN_SECRET && !(await isAdminRequest(req))) {
      return res.status(500).json({
        error: "Admin approval is not configured. Set ADMIN_SECRET in environment."
      });
    }

    if (!isAuthorizedAdmin) {
      return res.status(401).json({
        error: "Unauthorized rejection request"
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: "userId is required"
      });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    // Mark user as not registered / not approved so they cannot login
    user.isApproved = false;
    user.isRegistered = false;
    await user.save();

    res.json({
      success: true,
      message: "User rejected successfully",
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (err) {
    console.error("REJECTION ERROR:", err);
    res.status(500).json({
      error: "Rejection failed",
      details: err?.message || String(err),
    });
  }
});

module.exports = router;
