// routes/auth.js — Registration & Login
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../config/db");

// ── Validation rules ─────────────────────────────────────────
const registerValidation = [
  body("organisation_name")
    .trim()
    .notEmpty()
    .withMessage("Organisation name required"),
  body("organisation_type")
    .trim()
    .notEmpty()
    .withMessage("Organisation type required"),
  body("country").trim().notEmpty().withMessage("Country required"),
  body("state").trim().notEmpty().withMessage("state required"),
  body("district").trim().notEmpty().withMessage("district required"),
  body("zone").trim().notEmpty().withMessage("zonerequired"),
  body("ward").trim().notEmpty().withMessage("ward required"),
  body("role").trim().notEmpty().withMessage("role required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain an uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain a special character"),
];

const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ── POST /auth/register ───────────────────────────────────────
router.post("/register", registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const {
    organisation_name,
    organisation_type,
    email,
    password,
    country,
    state,
    district,
    zone,
    ward,
    role = "buyer",
  } = req.body;

  try {
    // Check duplicate email
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [
      email,
    ]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password (cost factor 12)
    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
         (organisation_name, organisation_type, email, password_hash,
          country, state, district, zone, ward, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, email, organisation_name, role`,
      [
        organisation_name,
        organisation_type,
        email,
        password_hash,
        country,
        state,
        district,
        zone,
        ward,
        role,
      ],
    );

    return res.status(201).json({
      message: "Registration successful. Please log in.",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post("/login", loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, role, organisation_name
       FROM users WHERE email=$1 AND is_active=true`,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate access token (15 min) + refresh token (7 days)
    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    // Store refresh token hash
    const tokenHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)",
      [user.id, tokenHash, expiresAt],
    );

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.organisation_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    // In production: find and delete the matching token hash
    // Simplified: just inform client to discard token
  }
  return res.json({ message: "Logged out successfully" });
});

module.exports = router;
