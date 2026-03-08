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
    const {
      project_id,
      reporting_year,
      year,
      scope1,
      scope2,
      scope3,
      forest_area_m2,
      tree_count,
      other_absorption_co2e,
      emission,
      absorption,
    } = req.body;
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

    // Resolve district FK for emission_records (prefer explicit payload, fallback by user profile).
    let districtId = req.body.district_id ?? null;
    if (!districtId) {
      try {
        const distRes = await pool.query(
          `SELECT d.gid
           FROM users u
           JOIN state_table s
             ON LOWER(TRIM(s.st_nm)) = LOWER(TRIM(u.state))
           JOIN district_table d
             ON d.state_id = s.id
            AND LOWER(TRIM(d.distname)) = LOWER(TRIM(u.district))
           WHERE u.id = $1
           LIMIT 1`,
          [userId],
        );
        districtId = distRes.rows[0]?.gid ?? null;
      } catch (resolveErr) {
        console.warn("District resolution skipped:", resolveErr.message);
      }
    }

    // Forward to FastAPI for calculation
    const fastApiPayload =
      scope1 || scope2 || scope3 || forest_area_m2 || tree_count || other_absorption_co2e
        ? {
            project_id: project_id || userId,
            scope1: scope1 || undefined,
            scope2: scope2 || undefined,
            scope3: scope3 || undefined,
            forest_area_m2: forest_area_m2 ?? undefined,
            tree_count: tree_count ?? undefined,
            other_absorption_co2e: other_absorption_co2e ?? undefined,
          }
        : {
            project_id: project_id || userId,
            emission: emission || {},
            absorption: absorption || {},
          };

    const calcResult = await forwardToFastAPI(
      "/api/v1/emission/calculate",
      fastApiPayload,
    );

    // Save result to emission_records
    await pool.query(
      `INSERT INTO emission_records
         (buyer_id, year, scope1_co2e, scope2_co2e, scope3_co2e, total_co2e,
          raw_co2, raw_ch4, raw_n2o, raw_hfc134a, raw_sf6, calculation_payload, district_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT DO NOTHING`,
      [
        buyerId,
        reporting_year || year || new Date().getFullYear(),
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
        districtId,
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
  const { country, state, district } = req.query;
  try {
    const filters = [];
    const values = [];
    if (country && String(country).trim()) {
      values.push(String(country).trim());
      filters.push(`LOWER(TRIM(u.country)) = LOWER(TRIM($${values.length}))`);
    }
    if (state && String(state).trim()) {
      values.push(String(state).trim());
      filters.push(`LOWER(TRIM(u.state)) = LOWER(TRIM($${values.length}))`);
    }
    if (district && String(district).trim()) {
      values.push(String(district).trim());
      filters.push(`LOWER(TRIM(u.district)) = LOWER(TRIM($${values.length}))`);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const emissionQuery = `
      SELECT er.year::int AS year,
             COALESCE(SUM(er.total_co2e), 0) AS emission_co2e,
             COALESCE(SUM(er.total_absorption), 0) AS absorption_co2e
      FROM emission_records er
      JOIN buyer_profiles bp ON bp.id = er.buyer_id
      JOIN users u ON u.id = bp.user_id
      ${whereClause}
      GROUP BY er.year
      ORDER BY er.year
    `;
    const emissionRes = await pool.query(emissionQuery, values);

    const tradedCreditsQuery = `
      SELECT EXTRACT(YEAR FROM ct.trade_date)::int AS year,
             COALESCE(SUM(ct.credits_traded), 0) AS credits_value
      FROM carbon_transactions ct
      JOIN users u ON u.id = ct.buyer_id
      ${whereClause}
      GROUP BY EXTRACT(YEAR FROM ct.trade_date)
      ORDER BY year
    `;
    const tradedRes = await pool.query(tradedCreditsQuery, values);

    const vintageColRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'seller_projects'
         AND column_name IN ('vintage', 'vintage_start')
       ORDER BY CASE WHEN column_name = 'vintage' THEN 0 ELSE 1 END
       LIMIT 1`,
    );
    const vintageCol = vintageColRes.rows[0]?.column_name;
    const generatedRes = vintageCol
      ? await pool.query(
          `SELECT sp.${vintageCol}::int AS year,
                  COALESCE(SUM(sp.credits_available), 0) AS credits_value
           FROM seller_projects sp
           JOIN users u ON u.id = sp.user_id
           ${whereClause}
           GROUP BY sp.${vintageCol}
           ORDER BY sp.${vintageCol}`,
          values,
        )
      : { rows: [] };

    const creditsByYear = new Map();
    tradedRes.rows.forEach((r) => {
      creditsByYear.set(Number(r.year), Number(r.credits_value) || 0);
    });
    generatedRes.rows.forEach((r) => {
      const y = Number(r.year);
      const existing = creditsByYear.get(y) || 0;
      creditsByYear.set(y, Math.max(existing, Number(r.credits_value) || 0));
    });

    const yearly_trend = emissionRes.rows.map((r) => ({
      year: Number(r.year),
      emission_co2e: Number(r.emission_co2e) || 0,
      absorption_co2e: Number(r.absorption_co2e) || 0,
      credits_traded: creditsByYear.get(Number(r.year)) || 0,
    }));

    const totals = yearly_trend.reduce(
      (acc, row) => {
        acc.emission += row.emission_co2e;
        acc.absorption += row.absorption_co2e;
        return acc;
      },
      { emission: 0, absorption: 0 },
    );
    const emissionBase = totals.emission || 1;

    return res.json({
      yearly_trend,
      top_indicators: {
        absorption_pct: (totals.absorption / emissionBase) * 100,
        emission_pct: ((totals.emission - totals.absorption) / emissionBase) * 100,
      },
      unit: "t CO2e",
    });
  } catch (err) {
    console.error("Dashboard summary failed:", err.message);
    return res.status(500).json({ error: "Dashboard summary failed" });
  }
});

// ── GET /carbon/dashboard/region ─────────────────────────────
router.get("/dashboard/region", authenticate, async (req, res) => {
  const { country, state, district } = req.query;
  try {
    const filters = [];
    const values = [];
    if (country && String(country).trim()) {
      values.push(String(country).trim());
      filters.push(`LOWER(TRIM(u.country)) = LOWER(TRIM($${values.length}))`);
    }
    if (state && String(state).trim()) {
      values.push(String(state).trim());
      filters.push(`LOWER(TRIM(u.state)) = LOWER(TRIM($${values.length}))`);
    }
    if (district && String(district).trim()) {
      values.push(String(district).trim());
      filters.push(`LOWER(TRIM(u.district)) = LOWER(TRIM($${values.length}))`);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const resolution = district
      ? "district"
      : state
        ? "district"
        : country
          ? "state"
          : "country";
    const groupExpr =
      resolution === "country"
        ? "u.country"
        : resolution === "state"
          ? "u.country, u.state"
          : "u.country, u.state, u.district";

    const query = `
      SELECT u.country,
             ${resolution === "country" ? "NULL::text AS state," : "u.state,"}
             ${resolution === "district" ? "u.district," : "NULL::text AS district,"}
             COALESCE(SUM(er.total_co2e), 0) AS total_emission_co2e,
             COALESCE(SUM(er.total_absorption), 0) AS total_absorption_co2e
      FROM emission_records er
      JOIN buyer_profiles bp ON bp.id = er.buyer_id
      JOIN users u ON u.id = bp.user_id
      ${whereClause}
      GROUP BY ${groupExpr}
      ORDER BY total_emission_co2e DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);
    return res.json({
      regions: result.rows.map((r) => ({
        country: r.country,
        state: r.state,
        district: r.district,
        total_emission_co2e: Number(r.total_emission_co2e) || 0,
        total_absorption_co2e: Number(r.total_absorption_co2e) || 0,
      })),
      resolution,
      unit: "t CO2e",
    });
  } catch (err) {
    console.error("Region data failed:", err.message);
    return res.status(500).json({ error: "Region data failed" });
  }
});

// ── GET /carbon/districts ──────────────────────────────────────
router.get("/districts", authenticate, async (req, res) => {
  const { state, country } = req.query;
  if (!state || !state.trim()) {
    return res.status(400).json({ error: "state query param is required" });
  }

  try {
    const vals = [state.trim()];
    let where = "WHERE state = $1";
    if (country && country.trim()) {
      vals.push(country.trim());
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
    console.error("District list error:", err.message);
    return res.status(500).json({ error: "Failed to load districts" });
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
