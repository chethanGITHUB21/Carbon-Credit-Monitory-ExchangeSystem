// routes/seller.js — Seller project registration
const router = require('express').Router();
const pool   = require('../config/db');
const auth   = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const sellerRules = [
  body('project_name').notEmpty(),
  body('project_type').notEmpty(),
  body('methodology').notEmpty(),
  body('baseline_emission').isFloat({ min: 0 }),
  body('annual_reduction').isFloat({ min: 0 }),
  body('price_per_credit').isFloat({ min: 0 }),
  body('vintage_start').isInt({ min: 2000 }),
  body('vintage_end').isInt({ min: 2000 }),
];

// POST /seller/project — register new seller project
router.post('/project', auth, sellerRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const {
    project_name, project_type, methodology,
    baseline_emission, annual_reduction, leakage = 0,
    buffer_percent = 10, price_per_credit,
    vintage_start, vintage_end, project_boundary,
  } = req.body;

  // Net Credits = (annual_reduction - leakage) × (1 - buffer_percent/100)
  const net_credits = (annual_reduction - leakage) * (1 - buffer_percent / 100);

  try {
    const result = await pool.query(
      `INSERT INTO seller_projects
         (user_id, project_name, project_type, methodology,
          baseline_emission, annual_reduction, leakage, buffer_percent,
          credits_available, price_per_credit, vintage_start, vintage_end,
          project_boundary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
       RETURNING *`,
      [req.user.id, project_name, project_type, methodology,
       baseline_emission, annual_reduction, leakage, buffer_percent,
       Math.max(0, net_credits), price_per_credit,
       vintage_start, vintage_end, project_boundary || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /seller/projects — list own projects
router.get('/projects', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM seller_projects WHERE user_id=$1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
