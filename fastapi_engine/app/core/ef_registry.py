"""
==============================================================================
  ef_registry.py  —  IPCC Emission Factor Registry  |  v3.0
==============================================================================
  Purpose : Centralised, nested EF lookup tables for structured
            multi-level activity inputs.
  Scope   : Industry (Stationary Combustion), Vehicles (Mobile Combustion),
            Aviation, Factories / IPPU
  Standard: IPCC 2006 + 2019 Refinement | GWP-100 AR5

  Unit convention (applies to EVERY table in this file):
  ─────────────────────────────────────────────────────
  Industry EFs  : tonne gas  per  tonne fuel consumed
  Vehicle  EFs  : tonne gas  per  km  (per vehicle-km)
  Aviation EFs  : tonne gas  per  flight  (whole-flight basis)
  IPPU EFs      : tonne CO₂  per  tonne product
  ─────────────────────────────────────────────────────
  All EF values are pre-expressed in IPCC base units so that
  NO additional unit conversion is needed after lookup.

  EF Lookup hierarchy:
    INDUSTRY_EF  [industry_type][manufacturing_category][fuel_type]  → {gas: t/t-fuel}
    VEHICLE_EF   [vehicle_category][fuel_type][model_standard]       → {gas: t/km}
    AVIATION_EF  [flight_type][aircraft_type][fuel_type][distance_band] → {gas: t/flight}
    IPPU_EF      [industry_type][manufacturing_type]                 → {gas: t/t-product}

  Sources:
    [1] IPCC 2006 Vol.2 Ch.2  – Stationary Combustion
    [2] IPCC 2006 Vol.2 Ch.3  – Mobile Combustion
    [3] IPCC 2006 Vol.3 Ch.2  – Cement IPPU
    [4] IPCC 2006 Vol.3 Ch.4  – Iron & Steel IPPU
    [5] IPCC 2006 Vol.3 Ch.3  – Chemical Industry
    [6] IPCC 1999 Aviation & Global Atmosphere  – RFI basis
    [7] DEFRA 2023 GHG Conversion Factors       – Vehicle, Aviation EFs
    [8] BEE India / PCRA / MoPNG               – BS4/BS6 Indian std EFs
==============================================================================
"""

# ══════════════════════════════════════════════════════════════════════════════
#  1. INDUSTRY EF REGISTRY
#
#  Hierarchy: industry_type → manufacturing_category → fuel_type → gas
#
#  Unit: tonne of gas  per  tonne of fuel consumed
#
#  Differentiation logic:
#    heavy scale   → older, less efficient boilers, higher CH₄/N₂O slip
#    medium scale  → modern but not best-available technology
#    small scale   → partial combustion, elevated non-CO₂ factors
#
#  Sources: IPCC 2006 Vol.2, Tables 2.2–2.5; BEE India process data
# ══════════════════════════════════════════════════════════════════════════════

INDUSTRY_EF = {

    # ── CEMENT PLANT ───────────────────────────────────────────────────────
    "cement": {
        "heavy": {
            # Unit: t gas / t fuel
            "coal":        {"CO2": 2.4210, "CH4": 0.000400, "N2O": 0.000200},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000080, "N2O": 0.000080},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000060, "N2O": 0.000015},
        },
        "medium": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000300, "N2O": 0.000150},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000060, "N2O": 0.000060},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000050, "N2O": 0.000010},
        },
        "small": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000500, "N2O": 0.000300},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000100, "N2O": 0.000100},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000080, "N2O": 0.000020},
        },
    },

    # ── TEXTILE PLANT ──────────────────────────────────────────────────────
    "textile": {
        "heavy": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000380, "N2O": 0.000180},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000075, "N2O": 0.000075},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000055, "N2O": 0.000012},
        },
        "medium": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000280, "N2O": 0.000140},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000060, "N2O": 0.000060},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000048, "N2O": 0.000009},
        },
        "small": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000480, "N2O": 0.000280},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000095, "N2O": 0.000095},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000075, "N2O": 0.000018},
        },
    },

    # ── POWER PLANT (thermal) ──────────────────────────────────────────────
    "power_plant": {
        "heavy": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000350, "N2O": 0.000175},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000070, "N2O": 0.000070},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000045, "N2O": 0.000010},
        },
        "medium": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000300, "N2O": 0.000150},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000060, "N2O": 0.000060},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000040, "N2O": 0.000008},
        },
        "small": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000450, "N2O": 0.000250},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000090, "N2O": 0.000090},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000065, "N2O": 0.000016},
        },
    },

    # ── STEEL PLANT ────────────────────────────────────────────────────────
    "steel": {
        "heavy": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000420, "N2O": 0.000210},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000085, "N2O": 0.000085},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000062, "N2O": 0.000016},
        },
        "medium": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000310, "N2O": 0.000155},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000065, "N2O": 0.000065},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000052, "N2O": 0.000011},
        },
        "small": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000520, "N2O": 0.000310},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000105, "N2O": 0.000105},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000082, "N2O": 0.000022},
        },
    },

    # ── CHEMICAL PLANT ─────────────────────────────────────────────────────
    "chemical": {
        "heavy": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000400, "N2O": 0.000200},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000080, "N2O": 0.000080},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000058, "N2O": 0.000013},
        },
        "medium": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000295, "N2O": 0.000148},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000062, "N2O": 0.000062},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000048, "N2O": 0.000009},
        },
        "small": {
            "coal":        {"CO2": 2.4210, "CH4": 0.000490, "N2O": 0.000290},
            "diesel":      {"CO2": 3.1690, "CH4": 0.000098, "N2O": 0.000098},
            "natural_gas": {"CO2": 2.7500, "CH4": 0.000076, "N2O": 0.000019},
        },
    },
}

# ── GENERIC INDUSTRY FALLBACK (backward compatibility) ─────────────────────
# Used when industry_type not found in INDUSTRY_EF.
# Unit: t gas / t fuel   (IPCC 2006 Vol.2 Table 2.2 default values)
INDUSTRY_EF_GENERIC = {
    "coal":        {"CO2": 2.4210, "CH4": 0.000300, "N2O": 0.000150},
    "diesel":      {"CO2": 3.1690, "CH4": 0.000060, "N2O": 0.000060},
    "natural_gas": {"CO2": 2.7500, "CH4": 0.000050, "N2O": 0.000010},
}


# ══════════════════════════════════════════════════════════════════════════════
#  2. VEHICLE EF REGISTRY
#
#  Hierarchy: vehicle_category → fuel_type → model_standard → gas
#
#  Unit: tonne of gas  per  km  (for total vehicle-km)
#
#  Model standards:
#    BS4  : Bharat Stage 4 (India, pre-2020)
#    BS6  : Bharat Stage 6 (India, 2020+, equivalent Euro 6)
#    Euro5: European standard phase 5
#    Euro6: European standard phase 6 (strictest)
#    EV   : Zero tailpipe; all gas values = 0.0 (scope boundary)
#
#  EV scope note:
#    EV tailpipe = 0 (Scope 1 boundary).
#    Upstream electricity emissions (Scope 2) are NOT added here
#    to preserve inventory scope consistency (IPCC/GHG Protocol).
#
#  Sources: DEFRA 2023; CPCB India; ARAI; Euro 6 regulation data
# ══════════════════════════════════════════════════════════════════════════════

VEHICLE_EF = {

    # ── PASSENGER CAR ──────────────────────────────────────────────────────
    "car": {
        "petrol": {
            # Unit: t gas / km
            "BS4":   {"CO2": 0.000190, "CH4": 0.0000002, "N2O": 0.0000008},
            "BS6":   {"CO2": 0.000170, "CH4": 0.0000001, "N2O": 0.0000005},
            "Euro5": {"CO2": 0.000165, "CH4": 0.0000001, "N2O": 0.0000004},
            "Euro6": {"CO2": 0.000155, "CH4": 0.0000001, "N2O": 0.0000003},
        },
        "diesel": {
            "BS4":   {"CO2": 0.000185, "CH4": 0.0000001, "N2O": 0.0000007},
            "BS6":   {"CO2": 0.000168, "CH4": 0.0000001, "N2O": 0.0000005},
            "Euro5": {"CO2": 0.000160, "CH4": 0.0000001, "N2O": 0.0000004},
            "Euro6": {"CO2": 0.000148, "CH4": 0.0000001, "N2O": 0.0000003},
        },
        "cng": {
            "BS4":   {"CO2": 0.000145, "CH4": 0.0000008, "N2O": 0.0000002},
            "BS6":   {"CO2": 0.000130, "CH4": 0.0000005, "N2O": 0.0000001},
            "Euro5": {"CO2": 0.000125, "CH4": 0.0000004, "N2O": 0.0000001},
            "Euro6": {"CO2": 0.000118, "CH4": 0.0000003, "N2O": 0.0000001},
        },
        "ev": {
            # Tailpipe = 0 (Scope 1 only); upstream electricity not included
            "generic": {"CO2": 0.0, "CH4": 0.0, "N2O": 0.0},
        },
    },

    # ── TRUCK / HEAVY GOODS VEHICLE ────────────────────────────────────────
    "truck": {
        "diesel": {
            "BS4":   {"CO2": 0.000950, "CH4": 0.0000006, "N2O": 0.0000035},
            "BS6":   {"CO2": 0.000870, "CH4": 0.0000005, "N2O": 0.0000028},
            "Euro5": {"CO2": 0.000840, "CH4": 0.0000004, "N2O": 0.0000025},
            "Euro6": {"CO2": 0.000800, "CH4": 0.0000003, "N2O": 0.0000020},
        },
        "cng": {
            "BS4":   {"CO2": 0.000780, "CH4": 0.0000012, "N2O": 0.0000010},
            "BS6":   {"CO2": 0.000700, "CH4": 0.0000009, "N2O": 0.0000007},
            "Euro5": {"CO2": 0.000680, "CH4": 0.0000008, "N2O": 0.0000006},
            "Euro6": {"CO2": 0.000650, "CH4": 0.0000006, "N2O": 0.0000005},
        },
        "ev": {
            "generic": {"CO2": 0.0, "CH4": 0.0, "N2O": 0.0},
        },
    },

    # ── BUS / URBAN TRANSIT ────────────────────────────────────────────────
    "bus": {
        "diesel": {
            "BS4":   {"CO2": 0.000095, "CH4": 0.0000002, "N2O": 0.0000002},
            "BS6":   {"CO2": 0.000085, "CH4": 0.0000001, "N2O": 0.0000001},
            "Euro5": {"CO2": 0.000082, "CH4": 0.0000001, "N2O": 0.0000001},
            "Euro6": {"CO2": 0.000078, "CH4": 0.0000001, "N2O": 0.0000001},
        },
        "cng": {
            "BS4":   {"CO2": 0.000075, "CH4": 0.0000003, "N2O": 0.0000001},
            "BS6":   {"CO2": 0.000068, "CH4": 0.0000002, "N2O": 0.0000001},
            "Euro5": {"CO2": 0.000065, "CH4": 0.0000002, "N2O": 0.0000001},
            "Euro6": {"CO2": 0.000062, "CH4": 0.0000001, "N2O": 0.0000001},
        },
        "ev": {
            "generic": {"CO2": 0.0, "CH4": 0.0, "N2O": 0.0},
        },
    },

    # ── MOTORCYCLE / TWO-WHEELER ───────────────────────────────────────────
    "motorcycle": {
        "petrol": {
            "BS4":   {"CO2": 0.000108, "CH4": 0.0000003, "N2O": 0.0000003},
            "BS6":   {"CO2": 0.000098, "CH4": 0.0000002, "N2O": 0.0000002},
            "Euro5": {"CO2": 0.000095, "CH4": 0.0000002, "N2O": 0.0000002},
            "Euro6": {"CO2": 0.000090, "CH4": 0.0000001, "N2O": 0.0000001},
        },
        "ev": {
            "generic": {"CO2": 0.0, "CH4": 0.0, "N2O": 0.0},
        },
    },
}

# ── VEHICLE FALLBACK EFs (backward compat, generic/old input) ──────────────
# Unit: t gas / km
VEHICLE_EF_GENERIC = {
    "car":        {"CO2": 0.000180, "CH4": 0.0000001, "N2O": 0.0000006},
    "truck":      {"CO2": 0.000900, "CH4": 0.0000005, "N2O": 0.0000030},
    "bus":        {"CO2": 0.000089, "CH4": 0.0000001, "N2O": 0.0000001},
    "motorcycle": {"CO2": 0.000103, "CH4": 0.0000002, "N2O": 0.0000002},
}


# ══════════════════════════════════════════════════════════════════════════════
#  3. AVIATION EF REGISTRY
#
#  Hierarchy: flight_type → aircraft_type → fuel_type → distance_band → gas
#
#  Unit: tonne of gas  per  flight  (whole-flight basis, both directions)
#        These are DIRECT combustion EFs before RFI application.
#        RFI multiplier (1.9) is applied in the sector function, NOT here.
#
#  Flight type   : domestic / international
#  Aircraft type : narrow_body (single-aisle) / wide_body (twin-aisle)
#  Fuel type     : jet_a1 (conventional) / saf_blend (30% SAF, 70% Jet-A1)
#  Distance band : short (<1500 km) / medium (1500–4000 km) / long (>4000 km)
#
#  SAF note: SAF blend reduces CO₂ EF by ~21% (30% SAF × 70% lifecycle reduction)
#            CH₄ and N₂O remain similar (combustion quality unchanged).
#
#  Sources: ICAO Carbon Emissions Calculator methodology; DEFRA 2023;
#           IATA Fuel-burn database estimates; IPCC 1999 Aviation Ch.7
# ══════════════════════════════════════════════════════════════════════════════

AVIATION_EF = {

    "domestic": {
        "narrow_body": {
            "jet_a1": {
                # Unit: t gas / flight
                "short":  {"CO2": 2.850,  "CH4": 0.000040, "N2O": 0.000090},
                "medium": {"CO2": 8.200,  "CH4": 0.000110, "N2O": 0.000260},
                "long":   {"CO2": 15.500, "CH4": 0.000200, "N2O": 0.000480},
            },
            "saf_blend": {
                # CO₂ reduced ~21% vs jet_a1; CH₄/N₂O unchanged
                "short":  {"CO2": 2.252,  "CH4": 0.000040, "N2O": 0.000090},
                "medium": {"CO2": 6.478,  "CH4": 0.000110, "N2O": 0.000260},
                "long":   {"CO2": 12.245, "CH4": 0.000200, "N2O": 0.000480},
            },
        },
        "wide_body": {
            "jet_a1": {
                "short":  {"CO2": 5.200,  "CH4": 0.000070, "N2O": 0.000160},
                "medium": {"CO2": 18.000, "CH4": 0.000240, "N2O": 0.000580},
                "long":   {"CO2": 38.000, "CH4": 0.000500, "N2O": 0.001200},
            },
            "saf_blend": {
                "short":  {"CO2": 4.108,  "CH4": 0.000070, "N2O": 0.000160},
                "medium": {"CO2": 14.220, "CH4": 0.000240, "N2O": 0.000580},
                "long":   {"CO2": 30.020, "CH4": 0.000500, "N2O": 0.001200},
            },
        },
    },

    "international": {
        "narrow_body": {
            "jet_a1": {
                "short":  {"CO2": 3.100,  "CH4": 0.000042, "N2O": 0.000095},
                "medium": {"CO2": 9.000,  "CH4": 0.000120, "N2O": 0.000280},
                "long":   {"CO2": 18.000, "CH4": 0.000230, "N2O": 0.000560},
            },
            "saf_blend": {
                "short":  {"CO2": 2.449,  "CH4": 0.000042, "N2O": 0.000095},
                "medium": {"CO2": 7.110,  "CH4": 0.000120, "N2O": 0.000280},
                "long":   {"CO2": 14.220, "CH4": 0.000230, "N2O": 0.000560},
            },
        },
        "wide_body": {
            "jet_a1": {
                "short":  {"CO2": 6.500,  "CH4": 0.000088, "N2O": 0.000200},
                "medium": {"CO2": 22.000, "CH4": 0.000290, "N2O": 0.000700},
                "long":   {"CO2": 52.000, "CH4": 0.000680, "N2O": 0.001650},
            },
            "saf_blend": {
                "short":  {"CO2": 5.135,  "CH4": 0.000088, "N2O": 0.000200},
                "medium": {"CO2": 17.380, "CH4": 0.000290, "N2O": 0.000700},
                "long":   {"CO2": 41.080, "CH4": 0.000680, "N2O": 0.001650},
            },
        },
    },
}

# ── AVIATION FALLBACK (backward compat — fuel-kg-per-flight mode) ──────────
# Used if structured aviation lookup fails.
# Returns a multiplier dict; CO₂ = fuel_t × CO2_EF; then apply RFI.
AVIATION_EF_GENERIC = {
    "CO2_per_tonne_fuel": 3.16,    # t CO₂ / t Jet-A1   (IPCC 1999)
    "RFI":                1.9,     # Radiative Forcing Index (IPCC 1999)
}


# ══════════════════════════════════════════════════════════════════════════════
#  4. IPPU (Factory / Industrial Process) EF REGISTRY
#
#  Hierarchy: industry_type → manufacturing_type → gas
#
#  Unit: tonne of gas  per  tonne of product manufactured
#
#  Process emissions represent CO₂ release from chemical reactions
#  (calcination, smelting, reforming), NOT fuel combustion.
#  These are in ADDITION to any stationary combustion from the Industry sector.
#
#  Sources: IPCC 2006 Vol.3 Ch.2 (cement), Ch.4 (steel), Ch.3 (chemicals)
# ══════════════════════════════════════════════════════════════════════════════

IPPU_EF = {

    # ── CEMENT (process CO₂ from limestone calcination) ───────────────────
    "cement": {
        "dry_process": {
            # Dry process: more energy-efficient, slightly lower EF
            # Source: IPCC 2006 Vol.3 Table 2.1
            "CO2": 0.5100, "CH4": 0.0, "N2O": 0.0,
        },
        "wet_process": {
            # Wet process: older, less efficient
            "CO2": 0.5700, "CH4": 0.0, "N2O": 0.0,
        },
        "preheater": {
            # Modern preheater / precalciner kilns
            "CO2": 0.4900, "CH4": 0.0, "N2O": 0.0,
        },
    },

    # ── STEEL (CO₂ from coke combustion in blast furnace) ─────────────────
    "steel": {
        "integrated_bof": {
            # Integrated blast furnace + basic oxygen furnace
            # Source: IPCC 2006 Vol.3 Table 4.1
            "CO2": 1.9000, "CH4": 0.0, "N2O": 0.0,
        },
        "electric_arc": {
            # Electric arc furnace (scrap-based) — lower process EF
            "CO2": 0.4000, "CH4": 0.0, "N2O": 0.0,
        },
        "dri_gas": {
            # Direct Reduced Iron using natural gas
            "CO2": 0.7000, "CH4": 0.0, "N2O": 0.0,
        },
    },

    # ── CHEMICALS ──────────────────────────────────────────────────────────
    "chemicals": {
        "ammonia_synthesis": {
            # Source: IPCC 2006 Vol.3 Ch.3
            # CO₂ from steam reforming of natural gas
            "CO2": 1.6940, "CH4": 0.0, "N2O": 0.0,
        },
        "nitric_acid": {
            # N₂O from catalytic oxidation of ammonia
            # Source: IPCC 2006 Vol.3 Table 3.4
            "CO2": 0.0, "CH4": 0.0, "N2O": 0.0092,
        },
        "methanol_production": {
            # CO₂ from steam reforming
            "CO2": 0.6800, "CH4": 0.0, "N2O": 0.0,
        },
    },

    # ── ALUMINIUM ──────────────────────────────────────────────────────────
    "aluminium": {
        "prebake": {
            # Process CO₂ + PFC (simplified as CO₂ equiv via separate factor)
            # Source: IPCC 2006 Vol.3 Ch.4
            "CO2": 1.5500, "CH4": 0.0, "N2O": 0.0,
        },
        "soderberg": {
            "CO2": 2.0000, "CH4": 0.0, "N2O": 0.0,
        },
    },
}

# ── IPPU GENERIC FALLBACK (backward compat) ────────────────────────────────
# Unit: t CO₂ / t product
IPPU_EF_GENERIC = {
    "cement": 0.54,    # IPCC 2006 Vol.3 Ch.2 (clinker-based)
    "steel":  1.90,    # IPCC 2006 Vol.3 Ch.4 (integrated steel)
}


# ══════════════════════════════════════════════════════════════════════════════
#  5. EF LOOKUP HELPER FUNCTIONS
#     Centralised, safe lookup with fallback to generic EFs.
# ══════════════════════════════════════════════════════════════════════════════

def lookup_industry_ef(industry_type: str,
                       manufacturing_category: str,
                       fuel_type: str) -> dict:
    """
    Return EF dict (t gas / t fuel) for industry stationary combustion.
    Falls back to INDUSTRY_EF_GENERIC[fuel_type] if hierarchy not found.
    """
    try:
        return INDUSTRY_EF[industry_type][manufacturing_category][fuel_type]
    except KeyError:
        if fuel_type in INDUSTRY_EF_GENERIC:
            return INDUSTRY_EF_GENERIC[fuel_type]
        raise ValueError(
            f"EF lookup failed: No industry EF for "
            f"({industry_type} / {manufacturing_category} / {fuel_type}) "
            f"and generic fallback unavailable for fuel '{fuel_type}'."
        )


def lookup_vehicle_ef(vehicle_category: str,
                      fuel_type: str,
                      model_standard: str) -> dict:
    """
    Return EF dict (t gas / km) for vehicle mobile combustion.
    EV returns zero-gas dict (Scope 1 boundary).
    Falls back to VEHICLE_EF_GENERIC if standard not found.
    """
    try:
        return VEHICLE_EF[vehicle_category][fuel_type][model_standard]
    except KeyError:
        # Try generic fallback
        if vehicle_category in VEHICLE_EF_GENERIC:
            return VEHICLE_EF_GENERIC[vehicle_category]
        raise ValueError(
            f"EF lookup failed: No vehicle EF for "
            f"({vehicle_category} / {fuel_type} / {model_standard})."
        )


def lookup_aviation_ef(flight_type: str,
                       aircraft_type: str,
                       fuel_type: str,
                       distance_band: str) -> dict:
    """
    Return EF dict (t gas / flight) for aviation.
    EF is per WHOLE FLIGHT (direct combustion, pre-RFI).
    Falls back to None if lookup fails (caller uses generic fuel-based path).
    """
    try:
        return AVIATION_EF[flight_type][aircraft_type][fuel_type][distance_band]
    except KeyError:
        return None   # Caller will fall back to generic fuel-based EF


def lookup_ippu_ef(industry_type: str,
                   manufacturing_type: str) -> dict:
    """
    Return EF dict (t gas / t product) for IPPU process emissions.
    Falls back to IPPU_EF_GENERIC if not found.
    """
    try:
        return IPPU_EF[industry_type][manufacturing_type]
    except KeyError:
        if industry_type in IPPU_EF_GENERIC:
            return {"CO2": IPPU_EF_GENERIC[industry_type], "CH4": 0.0, "N2O": 0.0}
        raise ValueError(
            f"EF lookup failed: No IPPU EF for ({industry_type} / {manufacturing_type}) "
            f"and no generic fallback."
        )
