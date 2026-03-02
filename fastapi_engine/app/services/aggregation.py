"""
app/services/aggregation.py
────────────────────────────
Pure calculation layer: gas accumulation and GWP-weighted CO₂e aggregation.

STRICTLY UNCHANGED from CLI engine v3.0:
  - GWP values (AR5 / IPCC 2013, Table 8.A.1)
  - Aggregation formula: CO₂e = Σ(gas × GWP)
  - Gas accumulation logic
  - Unit conversions (m²→ha, kg→t, L→t, m³→t)

No I/O, no print statements, no CLI prompts.
All functions are pure: input → output, no side effects.
"""

# ─────────────────────────────────────────────────────────────
# GWP-100  (AR5 / IPCC 2013, Table 8.A.1)
# STRICTLY PRESERVED — do not modify these values.
# ─────────────────────────────────────────────────────────────
GWP: dict[str, int | float] = {
    "CO2":     1,       # Carbon Dioxide          – reference gas
    "CH4":     28,      # Methane
    "N2O":     265,     # Nitrous Oxide
    "HFC134a": 1300,    # HFC-134a (refrigerant)
    "SF6":     23500,   # Sulphur Hexafluoride
}


# ─────────────────────────────────────────────────────────────
# GAS DICT HELPERS
# ─────────────────────────────────────────────────────────────

def zero_gas_dict() -> dict[str, float]:
    """Return zeroed accumulator for all 5 GHGs."""
    return {g: 0.0 for g in GWP}


def accumulate_gases(accumulator: dict[str, float],
                     gas_dict: dict[str, float]) -> None:
    """Add gas_dict values into accumulator in-place (cross-sector summation)."""
    for gas in GWP:
        accumulator[gas] += gas_dict.get(gas, 0.0)


def to_co2e(gas_dict: dict[str, float]) -> float:
    """
    CO₂e = Σ (gas_tonnes × GWP_gas)
    Formula: (CO₂×1) + (CH₄×28) + (N₂O×265) + (HFC-134a×1300) + (SF₆×23500)
    All intermediate gas values must be computed before calling this.
    """
    return sum(gas_dict.get(g, 0.0) * GWP.get(g, 1) for g in GWP)


# ─────────────────────────────────────────────────────────────
# UNIT CONVERSIONS
# All convert to IPCC base units before EF multiplication.
# Base units: tonne (mass), hectare (area), km (distance)
# ─────────────────────────────────────────────────────────────

def m2_to_hectare(m2: float) -> float:
    """m² → hectare.  1 ha = 10,000 m²."""
    if m2 < 0:
        raise ValueError(f"Area cannot be negative: {m2} m²")
    return m2 / 10_000.0


def kg_to_tonnes(kg: float) -> float:
    """kg → tonnes.  1 t = 1,000 kg."""
    return kg / 1_000.0


def litres_to_tonne_fuel(litres: float, fuel_type: str) -> float:
    """
    Litres → tonnes using standard fuel densities.
    Sources: IPCC 2006 Vol.2 Annex 2 / Engineering data
      diesel:       0.845 kg/L
      coal:         0.800 kg/L
      natural_gas:  0.00072 kg/L (compressed, approx.)
    """
    density: dict[str, float] = {
        "diesel":      0.845,
        "coal":        0.800,
        "natural_gas": 0.00072,
    }
    if fuel_type not in density:
        raise ValueError(
            f"Unit mismatch: no density for fuel '{fuel_type}'. "
            f"Supported: {list(density)}"
        )
    return litres * density[fuel_type] / 1_000.0


def m3_to_tonne_gas(m3: float, fuel_type: str) -> float:
    """
    m³ (volumetric) → tonnes for gaseous fuels.
    natural_gas density ≈ 0.000717 t/m³ (compressed, 15°C, 1 atm)
    """
    density_t_per_m3: dict[str, float] = {
        "natural_gas": 0.000717,
    }
    if fuel_type not in density_t_per_m3:
        raise ValueError(
            f"Unit mismatch: m³→tonne not supported for fuel '{fuel_type}'."
        )
    return m3 * density_t_per_m3[fuel_type]


def validate_positive(value: float, name: str) -> None:
    """Raise descriptive error for negative physical quantities."""
    if value < 0:
        raise ValueError(
            f"Unit validation failed: '{name}' = {value}. Must be ≥ 0."
        )


# ─────────────────────────────────────────────────────────────
# RESULT AGGREGATION
# Called after all sector/sink gas dicts are collected.
# ─────────────────────────────────────────────────────────────

def aggregate_results(
    emission_gas_dicts: dict[str, dict[str, float]],
    absorption_gas_dicts: dict[str, dict[str, float]],
) -> dict:
    """
    Aggregates all per-sector and per-sink gas dicts into final result.

    Returns a flat dict with:
      total_emission_co2e   : float
      total_absorption_co2e : float
      net_balance           : float
      status                : str
      offset_ratio_percent  : float
      gas_wise_totals       : {CO2, CH4, N2O, HFC134a, SF6}  (raw tonnes, pre-GWP)
      sector_breakdown      : {sector: co2e}
      sink_breakdown        : {sink: co2e}
    """
    # ── Emission aggregation ──────────────────────────────────
    total_gases_emit: dict[str, float] = zero_gas_dict()
    sector_co2e: dict[str, float]      = {}

    for sector, gd in emission_gas_dicts.items():
        accumulate_gases(total_gases_emit, gd)
        sector_co2e[sector] = to_co2e(gd)

    # ── Absorption aggregation ────────────────────────────────
    total_gases_abs: dict[str, float] = zero_gas_dict()
    sink_co2e: dict[str, float]       = {}

    for sink, gd in absorption_gas_dicts.items():
        accumulate_gases(total_gases_abs, gd)
        sink_co2e[sink] = to_co2e(gd)

    # ── Totals ────────────────────────────────────────────────
    total_emission   = to_co2e(total_gases_emit)
    total_absorption = to_co2e(total_gases_abs)
    net_balance      = total_emission - total_absorption

    # ── Offset ratio ──────────────────────────────────────────
    if total_emission > 0:
        offset_pct = (total_absorption / total_emission) * 100.0
    else:
        offset_pct = 100.0 if total_absorption > 0 else 0.0

    # ── Status verdict ────────────────────────────────────────
    if net_balance > 0:
        status = "NET EMITTER"
    elif net_balance < 0:
        status = "NET SINK"
    else:
        status = "CARBON NEUTRAL"

    return {
        "total_emission_co2e":   round(total_emission,   6),
        "total_absorption_co2e": round(total_absorption, 6),
        "net_balance":           round(net_balance,      6),
        "status":                status,
        "offset_ratio_percent":  round(offset_pct,       4),
        "gas_wise_totals": {
            "CO2":      round(total_gases_emit["CO2"],     8),
            "CH4":      round(total_gases_emit["CH4"],     8),
            "N2O":      round(total_gases_emit["N2O"],     8),
            "HFC-134a": round(total_gases_emit["HFC134a"], 8),
            "SF6":      round(total_gases_emit["SF6"],     8),
        },
        "sector_breakdown": {k: round(v, 6) for k, v in sector_co2e.items()},
        "sink_breakdown":   {k: round(v, 6) for k, v in sink_co2e.items()},
    }
