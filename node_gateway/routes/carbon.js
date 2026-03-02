// routes/carbon.js — Carbon API proxy (Node → FastAPI)
const router = require("express").Router();
const axios = require("axios");
const authenticate = require("../middleware/auth");
const pool = require("../config/db");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// ── Helper: forward to FastAPI ────────────────────────────────
async function forwardToFastAPI(endpoint, data) {
  const response = await axios.post(`${FASTAPI_URL}${endpoint}`, data, {
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
  });
  return response.data;
}

// ── POST /carbon/emission/calculate ──────────────────────────
// Buyer submits emission data → Node validates auth → FastAPI calculates → Node saves to DB
router.post("/emission/calculate", authenticate, async (req, res) => {
  try {
    const { project_id, emission, absorption, year } = req.body;
    const userId = req.user.id;

    // Get buyer profile
    const bpRes = await pool.query(
      "SELECT id FROM buyer_profiles WHERE user_id=$1",
      [userId],
    );
    if (bpRes.rows.length === 0) {
      return res.status(400).json({
        error: "Buyer profile not found. Complete registration first.",
      });
    }
    const buyerId = bpRes.rows[0].id;

    // Forward to FastAPI for calculation
    const calcResult = await forwardToFastAPI("/api/v1/emission/calculate", {
      project_id: project_id || userId,
      emission: emission || {},
      absorption: absorption || {},
    });

    // Save result to emission_records
    await pool.query(
      `INSERT INTO emission_records
         (buyer_id, year, scope1_co2e, scope2_co2e, scope3_co2e, total_co2e,
          raw_co2, raw_ch4, raw_n2o, raw_hfc134a, raw_sf6, calculation_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        buyerId,
        year || new Date().getFullYear(),
        req.body.scope1_co2e || calcResult.total_emission_co2e || 0,
        req.body.scope2_co2e || 0,
        req.body.scope3_co2e || 0,
        calcResult.total_emission_co2e || 0,
        calcResult.gas_wise_totals?.CO2 || 0,
        calcResult.gas_wise_totals?.CH4 || 0,
        calcResult.gas_wise_totals?.N2O || 0,
        calcResult.gas_wise_totals?.["HFC-134a"] || 0,
        calcResult.gas_wise_totals?.SF6 || 0,
        JSON.stringify(calcResult),
      ],
    );

    return res.json(calcResult);
  } catch (err) {
    console.error("Emission calculate error:", err.message);
    return res
      .status(502)
      .json({ error: "Calculation service error", detail: err.message });
  }
});

// ── POST /carbon/seller/calculate ────────────────────────────
router.post("/seller/calculate", authenticate, async (req, res) => {
  try {
    const result = await forwardToFastAPI("/api/v1/seller/calculate", req.body);
    return res.json(result);
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Seller calculation error", detail: err.message });
  }
});

// ── GET /carbon/dashboard/summary ────────────────────────────
router.get("/dashboard/summary", authenticate, async (req, res) => {
  try {
    const result = await axios.get(`${FASTAPI_URL}/api/v1/dashboard/summary`);
    return res.json(result.data);
  } catch (err) {
    console.error("FastAPI summary failed:", err.message);

    try {
      // Fallback: query DB directly
      const emission = await pool.query(
        "SELECT year, SUM(total_co2e) AS total FROM emission_records GROUP BY year ORDER BY year",
      );
      const credits = await pool.query(
        `SELECT vintage AS year, SUM(credits_available) AS credits
       FROM seller_projects WHERE verification_status='verified'
       GROUP BY vintage ORDER BY vintage`,
      );
      return res.json({
        yearly_emission: emission.rows,
        yearly_credits: credits.rows,
      });
    } catch (dbErr) {
      console.error("Fallback DB failed:", dbErr.message);
      return res.status(500).json({ error: "Dashboard summary failed" });
    }
  }
});

// ── GET /carbon/dashboard/region ─────────────────────────────
router.get("/dashboard/region", authenticate, async (req, res) => {
  const { country, state, district } = req.query;
  try {
    const cleanParams = Object.fromEntries(
      Object.entries({ country, state, district }).filter(
        ([_, v]) => v && v.trim() !== "",
      ),
    );
    const params = new URLSearchParams(cleanParams);
    const result = await axios.get(
      `${FASTAPI_URL}/api/v1/dashboard/region?${params}`,
    );
    return res.json(result.data);
  } catch (err) {
    // Fallback DB query
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
  }
});

// ── GET /carbon/marketplace ───────────────────────────────────
router.get("/marketplace", authenticate, async (req, res) => {
  const { project_type, min_price, max_price, vintage, country } = req.query;
  let q = `SELECT sp.*, u.organisation_name, u.country, u.state
           FROM seller_projects sp JOIN users u ON u.id = sp.user_id
           WHERE sp.is_active=true AND sp.verification_status='verified'
             AND sp.credits_available > 0`;
  const vals = [];
  if (project_type) {
    vals.push(project_type);
    q += ` AND sp.project_type=$${vals.length}`;
  }
  if (vintage) {
    vals.push(vintage);
    q += ` AND sp.vintage=$${vals.length}`;
  }
  if (min_price) {
    vals.push(min_price);
    q += ` AND sp.price_per_credit>=$${vals.length}`;
  }
  if (max_price) {
    vals.push(max_price);
    q += ` AND sp.price_per_credit<=$${vals.length}`;
  }
  if (country) {
    vals.push(country);
    q += ` AND u.country=$${vals.length}`;
  }
  q += " ORDER BY sp.price_per_credit ASC LIMIT 100";

  const result = await pool.query(q, vals);
  return res.json(result.rows);
});

// ── POST /carbon/trade ────────────────────────────────────────
router.post("/trade", authenticate, async (req, res) => {
  const { project_id, credits_to_buy } = req.body;
  const buyerId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const proj = await client.query(
      "SELECT * FROM seller_projects WHERE id=$1 AND verification_status=$2 FOR UPDATE",
      [project_id, "verified"],
    );
    if (proj.rows.length === 0)
      return res.status(404).json({ error: "Project not found" });

    const p = proj.rows[0];
    if (p.credits_available < credits_to_buy) {
      return res.status(400).json({ error: "Insufficient credits available" });
    }

    const total_value = credits_to_buy * p.price_per_credit;

    await client.query(
      `UPDATE seller_projects SET credits_available = credits_available - $1 WHERE id = $2`,
      [credits_to_buy, project_id],
    );

    const tx = await client.query(
      `INSERT INTO carbon_transactions
         (buyer_id, seller_id, project_id, credits_traded, price_per_credit, total_value, vintage)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        buyerId,
        p.user_id,
        project_id,
        credits_to_buy,
        p.price_per_credit,
        total_value,
        p.vintage,
      ],
    );

    await client.query("COMMIT");
    return res.status(201).json(tx.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Trade error:", err);
    return res.status(500).json({ error: "Trade failed" });
  } finally {
    client.release();
  }
});

module.exports = router;
