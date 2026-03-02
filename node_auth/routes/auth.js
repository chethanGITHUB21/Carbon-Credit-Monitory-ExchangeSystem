// routes/auth.js — Registration & Login
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const pool = require("../config/db");
const validate = require("../middleware/validate");

// ── Validation rules ────────────────────────────────────────
const registerRules = [
  body("organisation_type")
    .notEmpty()
    .withMessage("Organisation type required"),
  body("organisation_name")
    .notEmpty()
    .trim()
    .withMessage("Organisation name required"),
  body("country").notEmpty().withMessage("Country required"),
  body("state").notEmpty().withMessage("State required"),
  body("district").notEmpty().withMessage("District required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain a number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must contain special character"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
];

// ── POST /auth/register ─────────────────────────────────────
router.post("/register", registerRules, validate, async (req, res) => {
  const {
    organisation_type,
    organisation_name,
    country,
    state,
    district,
    zone,
    ward,
    email,
    password,
    role = "buyer",
  } = req.body;

  try {
    // Check duplicate email
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password (bcrypt, NEVER store plaintext)
    const password_hash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS) || 12,
    );

    const result = await pool.query(
      `INSERT INTO users
         (organisation_name, email, password_hash, organisation_type,
          country, state, district, zone, ward, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, email, organisation_name, role`,
      [
        organisation_name,
        email,
        password_hash,
        organisation_type,
        country,
        state,
        district,
        zone || null,
        ward || null,
        role,
      ],
    );

    res.status(201).json({
      message: "Registration successful. Please log in.",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Register error:", err.message, err.code);
    console.error("Full error:", err);
    res
      .status(500)
      .json({ error: "Registration failed", details: err.message });
  }
});

// ── POST /auth/login ────────────────────────────────────────
router.post("/login", loginRules, validate, async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT id, email, password_hash, organisation_name, role FROM users WHERE email=$1",
      [email],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organisation_name: user.organisation_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organisation_name: user.organisation_name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ── GET /auth/me ────────────────────────────────────────────
const authMiddleware = require("../middleware/auth");
router.get("/me", authMiddleware, async (req, res) => {
  const result = await pool.query(
    "SELECT id, organisation_name, email, country, state, district, role, created_at FROM users WHERE id=$1",
    [req.user.id],
  );
  res.json(result.rows[0] || {});
});

module.exports = router;
