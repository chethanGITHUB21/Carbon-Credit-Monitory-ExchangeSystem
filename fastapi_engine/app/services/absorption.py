"""
app/services/absorption.py
───────────────────────────
Absorption pipeline — all 7 natural/tech carbon sinks.

MIGRATION FROM CLI v3.0:
  - All input() prompts removed
  - Function arguments replace terminal input
  - All calculations PRESERVED exactly
  - All EF values PRESERVED exactly

Scientific principle (unchanged):
  Biological and natural sinks absorb CO₂ ONLY.
  CO₂e_absorption = CO₂_absorption  (GWP_CO₂ = 1, no multiplication)

Sink EFs (IPCC / FAO sources — unchanged):
  Wetland       : 25 tCO₂/ha/yr  (IPCC 2006 Vol.4 Ch.7)
  Forest        : 12 tCO₂/ha/yr  (IPCC 2006 Vol.4 Ch.4)
  Trees         : 0.02 tCO₂/tree/yr  (FAO / IPCC AFOLU)
  Carbon Tech   : Direct input (t CO₂ / yr)
  Coastal       : 20 tCO₂/ha/yr  (IPCC 2013 Coastal Supplement)
  Eco Park      : 15 tCO₂/ha/yr
  River / Pond  :  5 tCO₂/ha/yr

All area inputs in m² → converted to hectares (÷ 10,000) before multiplication.
"""

from app.schemas import (
    AbsorptionPayload,
    AreaSinkInput,
    CarbonSinkTechInput,
    TreesInput,
)
from app.services.aggregation import m2_to_hectare, zero_gas_dict


# ─────────────────────────────────────────────────────────────
# HELPER: build CO₂-only gas dict for biological sinks
# ─────────────────────────────────────────────────────────────
def _co2_sink(co2_tonnes: float) -> dict[str, float]:
    """Biological sink: CO₂e = CO₂  (GWP_CO₂ = 1)."""
    return {
        "CO2":     co2_tonnes,
        "CH4":     0.0,
        "N2O":     0.0,
        "HFC134a": 0.0,
        "SF6":     0.0,
    }


# ══════════════════════════════════════════════════════════════
#  SINK CALCULATORS
# ══════════════════════════════════════════════════════════════

def calc_wetland(inp: AreaSinkInput) -> dict[str, float]:
    """Wetland | EF: 25 tCO₂/ha/yr | IPCC 2006 Vol.4 Ch.7"""
    area_ha = m2_to_hectare(inp.area_m2)
    return _co2_sink(area_ha * 25.0)


def calc_forest(inp: AreaSinkInput) -> dict[str, float]:
    """Forest | EF: 12 tCO₂/ha/yr | IPCC 2006 Vol.4 Ch.4"""
    area_ha = m2_to_hectare(inp.area_m2)
    return _co2_sink(area_ha * 12.0)


def calc_trees(inp: TreesInput) -> dict[str, float]:
    """Individual Trees | EF: 0.02 tCO₂/tree/yr | FAO/IPCC AFOLU"""
    return _co2_sink(inp.number_of_trees * 0.02)


def calc_carbon_sink_tech(inp: CarbonSinkTechInput) -> dict[str, float]:
    """DAC / CCS Technology | Direct CO₂ captured input (no conversion)"""
    return _co2_sink(inp.co2_captured_tonnes_per_year)


def calc_coastal(inp: AreaSinkInput) -> dict[str, float]:
    """Blue Carbon (mangroves, seagrass) | EF: 20 tCO₂/ha/yr | IPCC 2013 Coastal Supplement"""
    area_ha = m2_to_hectare(inp.area_m2)
    return _co2_sink(area_ha * 20.0)


def calc_eco_park(inp: AreaSinkInput) -> dict[str, float]:
    """Eco-Friendly Park / Urban Green | EF: 15 tCO₂/ha/yr"""
    area_ha = m2_to_hectare(inp.area_m2)
    return _co2_sink(area_ha * 15.0)


def calc_river(inp: AreaSinkInput) -> dict[str, float]:
    """River / Pond Carbon Sink | EF: 5 tCO₂/ha/yr | IPCC inland water estimates"""
    area_ha = m2_to_hectare(inp.area_m2)
    return _co2_sink(area_ha * 5.0)


# ══════════════════════════════════════════════════════════════
#  ABSORPTION PIPELINE RUNNER
# ══════════════════════════════════════════════════════════════
def run_absorption_pipeline(absorption_payload: AbsorptionPayload) -> dict[str, dict[str, float]]:
    """
    Runs all available absorption sinks from the payload.
    Skips any sink that is None (not provided).

    Returns:
      {
        "wetland":          {CO2: float, CH4: 0, ...},
        "forest":           {...},
        "trees":            {...},
        "carbon_sink_tech": {...},
        "coastal":          {...},
        "eco_park":         {...},
        "river":            {...},
      }
    """
    results: dict[str, dict[str, float]] = {}

    sink_map = [
        ("wetland",          absorption_payload.wetland,          calc_wetland),
        ("forest",           absorption_payload.forest,           calc_forest),
        ("trees",            absorption_payload.trees,            calc_trees),
        ("carbon_sink_tech", absorption_payload.carbon_sink_tech, calc_carbon_sink_tech),
        ("coastal",          absorption_payload.coastal,          calc_coastal),
        ("eco_park",         absorption_payload.eco_park,         calc_eco_park),
        ("river",            absorption_payload.river,            calc_river),
    ]

    for name, inp, fn in sink_map:
        if inp is not None:
            results[name] = fn(inp)
        else:
            results[name] = zero_gas_dict()

    return results
