// routes/carbon.js — proxies calculation requests to FastAPI
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

    const data = fastapiRes.data;

    // Upsert buyer_profile for this user + year
    const bpResult = await pool.query(
      `INSERT INTO buyer_profiles (user_id, reporting_year, industry_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, reporting_year) DO UPDATE SET industry_type=EXCLUDED.industry_type
       RETURNING id`,
      [
        req.user.id,
        reporting_year || new Date().getFullYear(),
        industry_type || scope1?.industry_type || "general",
      ],
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
        gwt.CO2 || 0,
        gwt.CH4 || 0,
        gwt.N2O || 0,
        gwt["HFC-134a"] || 0,
        gwt.SF6 || 0,
        data.total_absorption_co2e || 0,
        data.net_balance || 0,
        data.offset_ratio_percent || 0,
        JSON.stringify(req.body),
        JSON.stringify(data.sector_breakdown || {}),
        JSON.stringify(data.sink_breakdown || {}),
        reporting_year || new Date().getFullYear(),
      ],
    );

    res.json(data);
  } catch (err) {
    console.error(
      "Emission calculate error:",
      err.response?.data || err.message,
    );
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.detail || "Calculation failed",
    });
  }
});

// ── POST /carbon/seller/calculate ──────────────────────────
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
  }
});

// ── GET /carbon/dashboard/summary ──────────────────────────
router.get("/dashboard/summary", auth, async (req, res) => {
  try {
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/summary`, {
      params: { user_id: req.user.id },
    });
    console.log("DEBUG: " + req.user.id);
    res.json(fastapiRes.data);
  } catch (err) {
    res.status(500).json({ error: "Dashboard summary failed" });
  }
});

// ── GET /carbon/dashboard/region ───────────────────────────
router.get("/dashboard/region", auth, async (req, res) => {
  const { country, state, district } = req.query;
  try {
    const cleanParams = Object.fromEntries(
      Object.entries({ country, state, district }).filter(
        ([_, v]) => v && String(v).trim() !== "",
      ),
    );
    const fastapiRes = await axios.get(`${FASTAPI}/api/v1/dashboard/region`, {
      params: cleanParams,
    });
    res.json(fastapiRes.data);
  } catch (err) {
    // Fallback to local DB views if FastAPI is unavailable/fails.
    try {
      let view = "vw_country_summary";
      let whereClause = "";
      const values = [];

      if (country && state && district) {
        view = "vw_district_summary";
        whereClause = "WHERE country=$1 AND state=$2 AND district=$3";
        values.push(country, state, district);
      } else if (country && state) {
        view = "vw_state_summary";
        whereClause = "WHERE country=$1 AND state=$2";
        values.push(country, state);
      } else if (country) {
        whereClause = "WHERE country=$1";
        values.push(country);
      }

      const result = await pool.query(
        `SELECT * FROM ${view} ${whereClause}`,
        values,
      );
      return res.json(result.rows);
    } catch (dbErr) {
      return res.status(500).json({ error: "Region data failed" });
    }
  }
});

// ── GET /carbon/districts ──────────────────────────────────────
router.get("/districts", auth, async (req, res) => {
  const { state, country } = req.query;
  if (!state || !String(state).trim()) {
    return res.status(400).json({ error: "state query param is required" });
  }

  try {
    const vals = [String(state).trim()];
    let where = "WHERE state = $1";
    if (country && String(country).trim()) {
      vals.push(String(country).trim());
      where += " AND country = $2";
    }

    const result = await pool.query(
      `SELECT DISTINCT district AS name
       FROM users
       ${where}
       AND district IS NOT NULL
       AND TRIM(district) <> ''
       ORDER BY district ASC`,
      vals,
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: "Failed to load districts" });
  }
});

// ── GET /carbon/marketplace ─────────────────────────────────
router.get("/marketplace", auth, async (req, res) => {
  const { project_type, min_price, max_price, vintage } = req.query;
  let query = `SELECT sp.*, u.organisation_name, u.country, u.state
               FROM seller_projects sp
               JOIN users u ON u.id = sp.user_id
               WHERE sp.status='active' AND sp.credits_available > 0`;
  const params = [];
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
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// ── POST /carbon/trade ──────────────────────────────────────
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
    const total = credits * p.price_per_credit;
    await client.query(
      `INSERT INTO carbon_transactions
         (buyer_id,seller_id,project_id,credits_traded,price_per_credit,total_value)
       VALUES ($1,$2,$3,$4,$5,$6)`,
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
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
