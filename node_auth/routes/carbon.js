// routes/carbon.js — proxies calculation requests to FastAPI
<<<<<<< HEAD
const router = require("express").Router();
const axios = require("axios");
const pool = require("../config/db");
const auth = require("../middleware/auth");

const FASTAPI = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

// ── POST /carbon/emission/calculate ────────────────────────
// Buyer submits emission data → forwarded to FastAPI → result saved
router.post("/emission/calculate", auth, async (req, res) => {
  try {
    const {
      project_id,
      reporting_year,
      industry_type,
      scope1,
      scope2,
      scope3,
      forest_area_m2,
      tree_count,
      other_absorption_co2e,
    } = req.body;

    // Forward to FastAPI
    const fastapiRes = await axios.post(
      `${FASTAPI}/api/v1/emission/calculate`,
      {
        project_id,
        scope1,
        scope2,
        scope3,
        forest_area_m2,
        tree_count,
        other_absorption_co2e,
      },
    );
=======
const router  = require('express').Router();
const axios   = require('axios');
const pool    = require('../config/db');
const auth    = require('../middleware/auth');

const FASTAPI = process.env.FASTAPI_BASE_URL || 'http://localhost:8000';

// ── POST /carbon/emission/calculate ────────────────────────
// Buyer submits emission data → forwarded to FastAPI → result saved
router.post('/emission/calculate', auth, async (req, res) => {
  try {
    const { project_id, emission, absorption, reporting_year, industry_type } = req.body;

    // Forward to FastAPI
    const fastapiRes = await axios.post(`${FASTAPI}/api/v1/emission/calculate`, {
      project_id,
      emission,
      absorption,
    });
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa

    const data = fastapiRes.data;

    // Upsert buyer_profile for this user + year
    const bpResult = await pool.query(
      `INSERT INTO buyer_profiles (user_id, reporting_year, industry_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, reporting_year) DO UPDATE SET industry_type=EXCLUDED.industry_type
       RETURNING id`,
<<<<<<< HEAD
      [
        req.user.id,
        reporting_year || new Date().getFullYear(),
        industry_type || scope1?.industry_type || "general",
      ],
=======
      [req.user.id, reporting_year || new Date().getFullYear(), industry_type || 'general']
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
    );
    const buyerId = bpResult.rows[0].id;

    // Save emission record
    const gwt = data.gas_wise_totals || {};
    await pool.query(
      `INSERT INTO emission_records
         (buyer_id, scope1_co2e, scope2_co2e, scope3_co2e, total_co2e,
          gas_co2, gas_ch4, gas_n2o, gas_hfc134a, gas_sf6,
          total_absorption, net_balance, offset_ratio_pct,
          raw_input, sector_breakdown, sink_breakdown, year)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        buyerId,
        data.scope1_co2e || data.total_emission_co2e || 0,
        data.scope2_co2e || 0,
        data.scope3_co2e || 0,
        data.total_emission_co2e || 0,
<<<<<<< HEAD
        gwt.CO2 || 0,
        gwt.CH4 || 0,
        gwt.N2O || 0,
        gwt["HFC-134a"] || 0,
        gwt.SF6 || 0,
=======
        gwt.CO2 || 0, gwt.CH4 || 0, gwt.N2O || 0,
        gwt['HFC-134a'] || 0, gwt.SF6 || 0,
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
        data.total_absorption_co2e || 0,
        data.net_balance || 0,
        data.offset_ratio_percent || 0,
        JSON.stringify(req.body),
        JSON.stringify(data.sector_breakdown || {}),
        JSON.stringify(data.sink_breakdown || {}),
        reporting_year || new Date().getFullYear(),
<<<<<<< HEAD
      ],
=======
      ]
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
    );

    res.json(data);
  } catch (err) {
<<<<<<< HEAD
    console.error(
      "Emission calculate error:",
      err.response?.data || err.message,
    );
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || "Calculation failed",
=======
    console.error('Emission calculate error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || 'Calculation failed',
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
    });
  }
});

// ── POST /carbon/seller/calculate ──────────────────────────
<<<<<<< HEAD
router.post("/seller/calculate", auth, async (req, res) => {
  try {
    const fastapiRes = await axios.post(
      `${FASTAPI}/api/v1/seller/calculate`,
      req.body,
    );
    res.json(fastapiRes.data);
  } catch (err) {
    res
      .status(err.response?.status || 500)
      .json({ error: err.response?.data?.detail || "Failed" });
=======
router.post('/seller/calculate', auth, async (req, res) => {
  try {
    const fastapiRes = await axios.post(`${FASTAPI}/api/v1/seller/calculate`, req.body);
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.detail || 'Failed' });
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
  }
});

// ── GET /carbon/dashboard/summary ──────────────────────────
<<<<<<< HEAD
router.get("/dashboard/summary", auth, async (req, res) => {
  try {
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/summary`, {
      params: { user_id: req.user.id },
    });
    console.log("DEBUG: " + req.user.id);
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(500).json({ error: "Dashboard summary failed" });
=======
router.get('/dashboard/summary', auth, async (req, res) => {
  try {
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/summary`, {
      params: { user_id: req.user.id }
    });
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(500).json({ error: 'Dashboard summary failed' });
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
  }
});

// ── GET /carbon/dashboard/region ───────────────────────────
<<<<<<< HEAD
router.get("/dashboard/region", auth, async (req, res) => {
  try {
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/region`, {
      params: req.query,
    });
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(500).json({ error: "Region data failed" });
=======
router.get('/dashboard/region', auth, async (req, res) => {
  try {
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/region`, {
      params: req.query
    });
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(500).json({ error: 'Region data failed' });
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
  }
});

// ── GET /carbon/marketplace ─────────────────────────────────
<<<<<<< HEAD
router.get("/marketplace", auth, async (req, res) => {
=======
router.get('/marketplace', auth, async (req, res) => {
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
  const { project_type, min_price, max_price, vintage } = req.query;
  let query = `SELECT sp.*, u.organisation_name, u.country, u.state
               FROM seller_projects sp
               JOIN users u ON u.id = sp.user_id
               WHERE sp.status='active' AND sp.credits_available > 0`;
  const params = [];
<<<<<<< HEAD
  if (project_type) {
    params.push(project_type);
    query += ` AND sp.project_type=$${params.length}`;
  }
  if (min_price) {
    params.push(min_price);
    query += ` AND sp.price_per_credit>=$${params.length}`;
  }
  if (max_price) {
    params.push(max_price);
    query += ` AND sp.price_per_credit<=$${params.length}`;
  }
  if (vintage) {
    params.push(vintage);
    query += ` AND sp.vintage_start<=$${params.length} AND sp.vintage_end>=$${params.length}`;
  }
  query += " ORDER BY sp.price_per_credit ASC LIMIT 50";
=======
  if (project_type) { params.push(project_type); query += ` AND sp.project_type=$${params.length}`; }
  if (min_price)    { params.push(min_price);    query += ` AND sp.price_per_credit>=$${params.length}`; }
  if (max_price)    { params.push(max_price);    query += ` AND sp.price_per_credit<=$${params.length}`; }
  if (vintage)      { params.push(vintage);       query += ` AND sp.vintage_start<=$${params.length} AND sp.vintage_end>=$${params.length}`; }
  query += ' ORDER BY sp.price_per_credit ASC LIMIT 50';
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// ── POST /carbon/trade ──────────────────────────────────────
<<<<<<< HEAD
router.post("/trade", auth, async (req, res) => {
  const { project_id, credits } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const proj = await client.query(
      "SELECT * FROM seller_projects WHERE id=$1 AND status=$2 FOR UPDATE",
      [project_id, "active"],
    );
    if (!proj.rows.length) throw new Error("Project not found or inactive");
    const p = proj.rows[0];
    if (p.credits_available < credits)
      throw new Error("Insufficient credits available");
=======
router.post('/trade', auth, async (req, res) => {
  const { project_id, credits } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const proj = await client.query(
      'SELECT * FROM seller_projects WHERE id=$1 AND status=$2 FOR UPDATE',
      [project_id, 'active']
    );
    if (!proj.rows.length) throw new Error('Project not found or inactive');
    const p = proj.rows[0];
    if (p.credits_available < credits) throw new Error('Insufficient credits available');
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
    const total = credits * p.price_per_credit;
    await client.query(
      `INSERT INTO carbon_transactions
         (buyer_id,seller_id,project_id,credits_traded,price_per_credit,total_value)
       VALUES ($1,$2,$3,$4,$5,$6)`,
<<<<<<< HEAD
      [req.user.id, p.user_id, project_id, credits, p.price_per_credit, total],
    );
    await client.query(
      "UPDATE seller_projects SET credits_available=credits_available-$1 WHERE id=$2",
      [credits, project_id],
    );
    await client.query("COMMIT");
    res.json({
      message: "Trade successful",
      total_value: total,
      credits_traded: credits,
    });
  } catch (err) {
    await client.query("ROLLBACK");
=======
      [req.user.id, p.user_id, project_id, credits, p.price_per_credit, total]
    );
    await client.query(
      'UPDATE seller_projects SET credits_available=credits_available-$1 WHERE id=$2',
      [credits, project_id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Trade successful', total_value: total, credits_traded: credits });
  } catch (err) {
    await client.query('ROLLBACK');
>>>>>>> 9b503307fb3435f878ea111635e31561035470aa
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
