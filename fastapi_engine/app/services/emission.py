"""
app/services/emission.py
─────────────────────────
Emission pipeline — all 6 sectors.

MIGRATION FROM CLI v3.0:
  - All input() prompts removed
  - Function arguments replace terminal input
  - All calculations PRESERVED exactly
  - All EF lookups PRESERVED exactly
  - All unit conversions PRESERVED exactly
  - Returns {gas: tonnes} dict per sector (same as CLI engine)

Calculation methodology:
  Step 1: Convert activity → IPCC base unit (tonne, ha, km)
  Step 2: Lookup EF from registry
  Step 3: Emission(gas) = activity_base × EF[gas]
  Step 4: Return gas_dict {CO2, CH4, N2O, HFC134a, SF6} in tonnes/year

Source standards:
  IPCC 2006 Vol.2 (Energy), Vol.3 (IPPU), Vol.4 (AFOLU)
  IPCC 2019 Refinement | GWP-100 AR5
"""

from app.core.ef_registry import (
    AVIATION_EF_GENERIC,
    lookup_aviation_ef,
    lookup_industry_ef,
    lookup_ippu_ef,
    lookup_vehicle_ef,
)
from app.schemas import (
    AviationInput,
    FactoryInput,
    IndustryInput,
    PopulationInput,
    StubbleInput,
    VehicleInput,
)
from app.services.aggregation import (
    kg_to_tonnes,
    litres_to_tonne_fuel,
    m2_to_hectare,
    m3_to_tonne_gas,
    validate_positive,
    zero_gas_dict,
)

# ── Legacy EF (stubble — unchanged from CLI engine v3.0) ──────────────────────
# Unit: tonne gas per hectare burned  (IPCC 2006 Vol.4, Table 2.5 / Eq. 2.27)
_STUBBLE_EF = {
    "CO2": 5.5700,
    "CH4": 0.2740,
    "N2O": 0.006830,
}


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 1 — INDUSTRY / STATIONARY COMBUSTION
# ══════════════════════════════════════════════════════════════════════════════
def calc_industry(inp: IndustryInput) -> dict[str, float]:
    """
    Formula: Emission(gas) = total_fuel_t × EF[industry_type][category][fuel_type][gas]
    Base unit: tonne fuel / year

    Steps:
      1. Convert fuel_consumed → tonnes (from litres / m³ if needed)
      2. Scale by number_of_factories
      3. EF lookup
      4. Multiply per gas
    """
    # ── Step 1: Convert fuel → tonne (base unit) ─────────────
    fuel_unit = inp.fuel_unit.value
    fuel_type = inp.fuel_type.value

    if fuel_unit == "litres":
        fuel_t_per_factory = litres_to_tonne_fuel(inp.fuel_consumed, fuel_type)
    elif fuel_unit == "m3":
        fuel_t_per_factory = m3_to_tonne_gas(inp.fuel_consumed, fuel_type)
    else:
        fuel_t_per_factory = inp.fuel_consumed

    # ── Step 2: Scale by factories ────────────────────────────
    total_fuel_t = fuel_t_per_factory * inp.number_of_factories
    validate_positive(total_fuel_t, "Industry total fuel (tonnes)")

    # ── Step 3: EF lookup ─────────────────────────────────────
    ef = lookup_industry_ef(
        inp.industry_type.value,
        inp.manufacturing_category.value,
        fuel_type,
    )

    # ── Step 4: Multiply per gas → tonnes ─────────────────────
    return {
        "CO2":     total_fuel_t * ef["CO2"],
        "CH4":     total_fuel_t * ef["CH4"],
        "N2O":     total_fuel_t * ef["N2O"],
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 2 — VEHICLES / MOBILE COMBUSTION
# ══════════════════════════════════════════════════════════════════════════════
def calc_vehicles(inp: VehicleInput) -> dict[str, float]:
    """
    Formula: Emission(gas) = total_km × EF[category][fuel][standard][gas]
    Base unit: km / year  (total vehicle-km)

    EV scope rule:
      fuel_type == "ev"  →  tailpipe = 0  (Scope 1 boundary)
      Upstream electricity (Scope 2) NOT added — preserves inventory scope.
    """
    # ── Step 1: Total km (base unit) ─────────────────────────
    total_km = inp.number_of_vehicles * inp.km_per_year

    # ── Step 2: EF lookup ─────────────────────────────────────
    ef = lookup_vehicle_ef(
        inp.vehicle_category.value,
        inp.fuel_type.value,
        inp.model_standard.value,
    )

    # ── Step 3: Multiply per gas ──────────────────────────────
    return {
        "CO2":     total_km * ef["CO2"],
        "CH4":     total_km * ef["CH4"],
        "N2O":     total_km * ef["N2O"],
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 3 — AVIATION
# ══════════════════════════════════════════════════════════════════════════════
def calc_aviation(inp: AviationInput) -> dict[str, float]:
    """
    Primary path  : EF lookup → t gas / flight → multiply by n_flights
    Fallback path : fuel_kg_per_flight → t fuel × 3.16 (IPCC) × RFI 1.9
    RFI (1.9) applied in both paths — unchanged from CLI engine.

    Source: IPCC 1999 Aviation & Global Atmosphere; ICAO; DEFRA 2023
    """
    ef = lookup_aviation_ef(
        inp.flight_type.value,
        inp.aircraft_type.value,
        inp.fuel_type.value,
        inp.distance_band.value,
    )

    RFI = AVIATION_EF_GENERIC["RFI"]   # 1.9 — unchanged

    if ef is not None:
        # ── Structured path: EF in t gas / flight ────────────
        n = inp.number_of_flights
        co2_direct = n * ef["CO2"]
        ch4        = n * ef.get("CH4", 0.0)
        n2o        = n * ef.get("N2O", 0.0)
        co2_rfi    = co2_direct * RFI   # apply radiative forcing index
        return {
            "CO2":     co2_rfi,
            "CH4":     ch4,
            "N2O":     n2o,
            "HFC134a": 0.0,
            "SF6":     0.0,
        }

    # ── Fallback: fuel-kg-per-flight path (v2.0 legacy mode) ─
    if inp.fuel_kg_per_flight is None:
        raise ValueError(
            "Aviation EF lookup failed for the given configuration and "
            "no fallback fuel_kg_per_flight was provided."
        )
    total_fuel_t = kg_to_tonnes(inp.number_of_flights * inp.fuel_kg_per_flight)
    co2_per_t    = AVIATION_EF_GENERIC["CO2_per_tonne_fuel"]   # 3.16
    co2_rfi      = total_fuel_t * co2_per_t * RFI
    return {
        "CO2":     co2_rfi,
        "CH4":     0.0,
        "N2O":     0.0,
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 4 — STUBBLE / AGRICULTURAL RESIDUE BURNING
# ══════════════════════════════════════════════════════════════════════════════
def calc_stubble(inp: StubbleInput) -> dict[str, float]:
    """
    Formula: Emission(gas) = area_ha × EF[gas]
    Input: area in m² → converted to hectares (÷ 10,000)
    Source: IPCC 2006 Vol.4, Ch.2, Eq. 2.27; Table 2.5
    """
    area_ha = m2_to_hectare(inp.area_m2)
    return {
        "CO2":     area_ha * _STUBBLE_EF["CO2"],
        "CH4":     area_ha * _STUBBLE_EF["CH4"],
        "N2O":     area_ha * _STUBBLE_EF["N2O"],
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 5 — HUMAN POPULATION BASELINE
# ══════════════════════════════════════════════════════════════════════════════
def calc_population(inp: PopulationInput) -> dict[str, float]:
    """
    Formula: Total = population × per_capita_CO₂e
    Per-capita value is a composite CO₂e figure; assigned to CO₂ slot.
    Source: World Bank / IEA national per-capita emission data
    """
    total_co2e = inp.population * inp.per_capita_co2e
    return {
        "CO2":     total_co2e,
        "CH4":     0.0,
        "N2O":     0.0,
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SECTOR 6 — FACTORIES / INDUSTRIAL PROCESS (IPPU)
# ══════════════════════════════════════════════════════════════════════════════
def calc_factories(inp: FactoryInput) -> dict[str, float]:
    """
    Formula: Emission(gas) = total_production × EF[industry_type][mfg_type][gas]
    Base unit: tonne product / year

    NOTE: Process emissions only (calcination, smelting, reforming).
          Fuel combustion emissions → use Sector 1 (Industry) separately.
    Source: IPCC 2006 Vol.3 Ch.2 (cement), Ch.4 (steel), Ch.3 (chemicals)
    """
    total_prod = inp.number_of_factories * inp.annual_production_per_factory
    validate_positive(total_prod, "IPPU total production (tonnes)")

    ef = lookup_ippu_ef(
        inp.industry_type.value,
        inp.manufacturing_type.value,
    )

    return {
        "CO2":     total_prod * ef.get("CO2", 0.0),
        "CH4":     total_prod * ef.get("CH4", 0.0),
        "N2O":     total_prod * ef.get("N2O", 0.0),
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  EMISSION PIPELINE RUNNER
# ══════════════════════════════════════════════════════════════════════════════
def run_emission_pipeline(emission_payload) -> dict[str, dict[str, float]]:
    """
    Runs all available emission sectors from the payload.
    Skips any sector that is None (not provided).

    Returns:
      {
        "industry":   {CO2: float, CH4: float, ...},
        "vehicles":   {...},
        "aviation":   {...},
        "factories":  {...},
        "stubble":    {...},
        "population": {...},
      }
    """
    results: dict[str, dict[str, float]] = {}

    sector_map = [
        ("industry",   emission_payload.industry,   calc_industry),
        ("vehicles",   emission_payload.vehicles,   calc_vehicles),
        ("aviation",   emission_payload.aviation,   calc_aviation),
        ("factories",  emission_payload.factories,  calc_factories),
        ("stubble",    emission_payload.stubble,    calc_stubble),
        ("population", emission_payload.population, calc_population),
    ]

    for name, inp, fn in sector_map:
        if inp is not None:
            results[name] = fn(inp)
        else:
            results[name] = zero_gas_dict()

    return results
