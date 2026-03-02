/**
 * CARBON CREDIT MONITORING & EXCHANGE SYSTEM
 * Example API Request / Response Payloads
 * ============================================================
 * IPCC 2006 + 2019 Refinement | GWP-100 AR5 | Tier 1
 */

// =============================================================
// AUTH: POST /auth/register
// =============================================================
const REGISTER_REQUEST = {
  "organisation_name": "Acme Steel Industries",
  "organisation_type": "Manufacturing",
  "email": "cfo@acmesteel.in",
  "password": "Secure@2024!",
  "role": "buyer",
  "country": "India",
  "state": "Tamil Nadu",
  "district": "Chennai",
  "zone": "North",
  "ward": "Ward 12"
};

const REGISTER_RESPONSE = {
  "message": "Registration successful. Please log in.",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "cfo@acmesteel.in",
    "organisation_name": "Acme Steel Industries",
    "role": "buyer"
  }
};

// =============================================================
// AUTH: POST /auth/login
// =============================================================
const LOGIN_REQUEST = {
  "email": "cfo@acmesteel.in",
  "password": "Secure@2024!"
};

const LOGIN_RESPONSE = {
  "accessToken":  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "user": {
    "id":   "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email":"cfo@acmesteel.in",
    "role": "buyer",
    "name": "Acme Steel Industries"
  }
};

// =============================================================
// CARBON: POST /carbon/emission/calculate (via Node.js)
// → Node forwards to FastAPI POST /api/v1/emission/calculate
// =============================================================
const EMISSION_REQUEST = {
  "year": 2024,
  "emission": {

    // Scope 1: Direct fuel combustion
    "industry": {
      "industry_type":          "steel",
      "manufacturing_category": "heavy",
      "fuel_type":              "coal",
      "fuel_unit":              "tonnes",
      "fuel_consumed":          800.0,
      "number_of_factories":    2
    },

    // Scope 2: Purchased electricity
    "scope2": {
      "electricity_kwh":    500000,
      "grid_ef_kg_per_kwh": 0.82        // India grid EF
    },

    // Scope 3: Transport + Waste
    "scope3": {
      "transport_co2e": 350.0,           // tCO₂e/year
      "waste_kg":       80000            // kg/year
    },

    // Additional: Vehicles
    "vehicles": {
      "vehicle_category":   "truck",
      "fuel_type":          "diesel",
      "model_standard":     "BS6",
      "number_of_vehicles": 30,
      "km_per_year":        50000
    },

    // Additional: IPPU process emissions
    "factories": {
      "industry_type":                 "steel",
      "manufacturing_type":            "integrated_bof",
      "number_of_factories":           2,
      "annual_production_per_factory": 40000.0
    }
  },

  "absorption": {
    "forest": { "area_m2": 2000000 },   // 200 ha
    "trees":  { "number_of_trees": 5000 }
  }
};

// FastAPI RESPONSE → forwarded through Node.js to browser
const EMISSION_RESPONSE = {
  "project_id":             "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "total_emission_co2e":    172893.842,
  "total_absorption_co2e":    2500.0,
  "net_balance":            170393.842,
  "status":                 "NET EMITTER",
  "offset_ratio_percent":    1.446,

  "gas_wise_totals": {
    "CO2":      168425.23000000,     // raw tonnes, pre-GWP
    "CH4":          15.87500000,
    "N2O":           9.32100000,
    "HFC-134a":      0.00000000,
    "SF6":           0.00000000
  },

  "sector_breakdown": {
    "industry":   7747.200,
    "scope2":     410.000,
    "scope3":     390.000,
    "vehicles":  1305.000,
    "factories": 152000.000,
    "aviation":    0.0,
    "stubble":     0.0,
    "population":  0.0
  },

  "sink_breakdown": {
    "wetland":          0.0,
    "forest":        2400.0,       // 200 ha × 12 tCO₂/ha
    "trees":          100.0,       // 5000 × 0.02
    "carbon_sink_tech": 0.0,
    "coastal":          0.0,
    "eco_park":         0.0,
    "river":            0.0
  },

  "compliance": {
    "standard":    "IPCC 2006 + 2019 Refinement",
    "gwp_basis":   "AR5 / IPCC 2013 (100-year)",
    "methodology": "Tier 1 (Activity × EF)",
    "base_units":  "tonne | hectare | km | year"
  }
};

// =============================================================
// SELLER: POST /carbon/seller/calculate
// → Node forwards to FastAPI POST /api/v1/seller/calculate
// =============================================================
const SELLER_REQUEST = {
  "annual_reduction":  8000,        // tCO₂e/year
  "leakage":           600,         // tCO₂e/year
  "buffer_percent":    10,          // 10%
  "baseline_emission": 12000,       // tCO₂e/year
  "methodology":       "VCS VM0007"
};

// Net Credits = (8000 − 600) × (1 − 10/100) = 7400 × 0.9 = 6660
const SELLER_RESPONSE = {
  "annual_reduction_co2e": 8000,
  "leakage_co2e":          600,
  "buffer_reserve_co2e":   666.0,
  "net_credits_co2e":      6660.0,
  "baseline_emission":     12000,
  "methodology":           "VCS VM0007",
  "standard":              "IPCC 2006 + 2019 Refinement | GWP-100 AR5"
};

// =============================================================
// DASHBOARD: GET /carbon/dashboard/summary
// =============================================================
const DASHBOARD_SUMMARY_RESPONSE = {
  "yearly_emission": [
    {"year": 2020, "total": "38000"},
    {"year": 2021, "total": "51200"},
    {"year": 2022, "total": "55800"},
    {"year": 2023, "total": "49300"},
    {"year": 2024, "total": "53100"}
  ],
  "yearly_credits": [
    {"year": 2020, "credits": "12000"},
    {"year": 2021, "credits": "14800"},
    {"year": 2022, "credits": "18200"},
    {"year": 2023, "credits": "22000"},
    {"year": 2024, "credits": "25400"}
  ]
};

// =============================================================
// REGION: GET /carbon/dashboard/region?country=India&state=Tamil+Nadu
// =============================================================
const REGION_RESPONSE = [
  {
    "country": "India",
    "state":   "Tamil Nadu",
    "total_emission_co2e": 42500.0,
    "num_organisations":   12
  }
];

// =============================================================
// TRADE: POST /carbon/trade
// =============================================================
const TRADE_REQUEST = {
  "project_id":     "b1c2d3e4-f5a6-7890-abcd-ef1234567890",
  "credits_to_buy": 500
};

const TRADE_RESPONSE = {
  "id":             "tx-uuid-here",
  "buyer_id":       "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "seller_id":      "seller-uuid-here",
  "project_id":     "b1c2d3e4-f5a6-7890-abcd-ef1234567890",
  "credits_traded": 500,
  "price_per_credit": 18.5,
  "total_value":    9250.0,
  "trade_date":     "2025-03-15",
  "vintage":        2024,
  "status":         "completed",
  "created_at":     "2025-03-15T10:30:00Z"
};

// =============================================================
// ERROR RESPONSES
// =============================================================
const ERROR_401 = { "error": "Authorization token required" };
const ERROR_422 = { "errors": [{ "type": "min_value", "loc": ["body","fuel_consumed"], "msg": "Value must be ≥ 0" }] };
const ERROR_404 = { "error": "Project not found" };
const ERROR_400 = { "error": "Insufficient credits available" };
