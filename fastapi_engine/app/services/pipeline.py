"""
fastapi_engine/app/services/pipeline.py
Emission (6 sectors) and Absorption (7 sinks) pipelines.
ALL formulas UNCHANGED from CLI v3.0.
"""

from app.core.ef_registry import (
    lookup_industry_ef, lookup_vehicle_ef, lookup_aviation_ef,
    lookup_ippu_ef, AVIATION_EF_GENERIC,
)
from app.services.aggregation import (
    zero_gas_dict, m2_to_hectare, litres_to_tonne_fuel,
    m3_to_tonne_gas, kg_to_tonnes,
)

# ── Stubble EF (IPCC 2006 Vol.4 Table 2.5) ───────────────────
_STUBBLE_EF = {"CO2": 5.5700, "CH4": 0.2740, "N2O": 0.006830}

# ── Scope 2 electricity EF default (global average kg CO₂/kWh) ─
_DEFAULT_GRID_EF_KG_PER_KWH = 0.475   # IEA 2023 global average


def _co2_sink(co2): return {"CO2": co2, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}


# ════════════════════════════════════════════════════
#  EMISSION SECTORS
# ════════════════════════════════════════════════════

def calc_industry(d: dict) -> dict:
    """Sector 1: Industry / Stationary Combustion"""
    fuel_type = d["fuel_type"]
    fuel_unit = d.get("fuel_unit", "tonnes")
    amount    = float(d["fuel_consumed"])
    n         = int(d.get("number_of_factories", 1))

    if fuel_unit == "litres":
        fuel_t = litres_to_tonne_fuel(amount, fuel_type) * n
    elif fuel_unit == "m3":
        fuel_t = m3_to_tonne_gas(amount, fuel_type) * n
    else:
        fuel_t = amount * n

    ef = lookup_industry_ef(
        d.get("industry_type", "cement"),
        d.get("manufacturing_category", "medium"),
        fuel_type
    )
    return {"CO2": fuel_t*ef["CO2"], "CH4": fuel_t*ef["CH4"],
            "N2O": fuel_t*ef["N2O"], "HFC134a": 0.0, "SF6": 0.0}


def calc_scope2_electricity(d: dict) -> dict:
    """Scope 2: Indirect emissions from purchased electricity"""
    kwh = float(d.get("electricity_kwh", 0))
    ef_kg = float(d.get("grid_ef_kg_per_kwh", _DEFAULT_GRID_EF_KG_PER_KWH))
    co2_tonnes = kwh * ef_kg / 1000.0
    return {"CO2": co2_tonnes, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}


def calc_scope3(d: dict) -> dict:
    """Scope 3: Transport + Waste (simplified Tier 1)"""
    transport = float(d.get("transport_co2e", 0))
    waste_kg   = float(d.get("waste_kg", 0))
    # IPCC default: landfill waste EF ≈ 0.5 kgCO₂e/kg waste
    waste_co2e = waste_kg * 0.5 / 1000.0
    return {"CO2": transport + waste_co2e, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}


def calc_vehicles(d: dict) -> dict:
    """Sector 2: Vehicles / Mobile Combustion"""
    ef = lookup_vehicle_ef(
        d.get("vehicle_category", "car"),
        d.get("fuel_type", "diesel"),
        d.get("model_standard", "BS6")
    )
    total_km = int(d.get("number_of_vehicles", 1)) * float(d.get("km_per_year", 0))
    return {"CO2": total_km*ef["CO2"], "CH4": total_km*ef["CH4"],
            "N2O": total_km*ef["N2O"], "HFC134a": 0.0, "SF6": 0.0}


def calc_aviation(d: dict) -> dict:
    """Sector 3: Aviation (RFI=1.9)"""
    ef = lookup_aviation_ef(
        d.get("flight_type","domestic"), d.get("aircraft_type","narrow_body"),
        d.get("fuel_type","jet_a1"), d.get("distance_band","medium")
    )
    n   = int(d.get("number_of_flights", 1))
    RFI = AVIATION_EF_GENERIC["RFI"]
    if ef:
        return {"CO2": n*ef["CO2"]*RFI, "CH4": n*ef.get("CH4",0),
                "N2O": n*ef.get("N2O",0), "HFC134a": 0.0, "SF6": 0.0}
    fuel_t = kg_to_tonnes(n * float(d.get("fuel_kg_per_flight", 0)))
    return {"CO2": fuel_t*3.16*RFI, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}


def calc_stubble(d: dict) -> dict:
    """Sector 4: Stubble Burning"""
    area_ha = m2_to_hectare(float(d.get("area_m2", 0)))
    return {"CO2": area_ha*_STUBBLE_EF["CO2"], "CH4": area_ha*_STUBBLE_EF["CH4"],
            "N2O": area_ha*_STUBBLE_EF["N2O"], "HFC134a": 0.0, "SF6": 0.0}


def calc_population(d: dict) -> dict:
    """Sector 5: Population Baseline"""
    return {"CO2": int(d.get("population",0))*float(d.get("per_capita_co2e",0)),
            "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}


def calc_factories(d: dict) -> dict:
    """Sector 6: IPPU Process Emissions"""
    ef   = lookup_ippu_ef(d.get("industry_type","cement"), d.get("manufacturing_type","dry_process"))
    prod = int(d.get("number_of_factories",1)) * float(d.get("annual_production_per_factory",0))
    return {"CO2": prod*ef.get("CO2",0), "CH4": prod*ef.get("CH4",0),
            "N2O": prod*ef.get("N2O",0), "HFC134a": 0.0, "SF6": 0.0}


# ════════════════════════════════════════════════════
#  ABSORPTION SINKS
# ════════════════════════════════════════════════════

def calc_wetland(d):   return _co2_sink(m2_to_hectare(float(d.get("area_m2",0))) * 25.0)
def calc_forest(d):    return _co2_sink(m2_to_hectare(float(d.get("area_m2",0))) * 12.0)
def calc_trees(d):     return _co2_sink(int(d.get("number_of_trees",0)) * 0.02)
def calc_tech(d):      return _co2_sink(float(d.get("co2_captured_tonnes_per_year",0)))
def calc_coastal(d):   return _co2_sink(m2_to_hectare(float(d.get("area_m2",0))) * 20.0)
def calc_eco_park(d):  return _co2_sink(m2_to_hectare(float(d.get("area_m2",0))) * 15.0)
def calc_river(d):     return _co2_sink(m2_to_hectare(float(d.get("area_m2",0))) * 5.0)


# ════════════════════════════════════════════════════
#  PIPELINE RUNNERS
# ════════════════════════════════════════════════════

EMISSION_HANDLERS = {
    "industry":   calc_industry,
    "scope2":     calc_scope2_electricity,
    "scope3":     calc_scope3,
    "vehicles":   calc_vehicles,
    "aviation":   calc_aviation,
    "stubble":    calc_stubble,
    "population": calc_population,
    "factories":  calc_factories,
}

ABSORPTION_HANDLERS = {
    "wetland":          calc_wetland,
    "forest":           calc_forest,
    "trees":            calc_trees,
    "carbon_sink_tech": calc_tech,
    "coastal":          calc_coastal,
    "eco_park":         calc_eco_park,
    "river":            calc_river,
}


def run_emission_pipeline(emission_payload: dict) -> dict:
    results = {}
    for name, fn in EMISSION_HANDLERS.items():
        data = emission_payload.get(name)
        results[name] = fn(data) if data else zero_gas_dict()
    return results


def run_absorption_pipeline(absorption_payload: dict) -> dict:
    results = {}
    for name, fn in ABSORPTION_HANDLERS.items():
        data = absorption_payload.get(name)
        results[name] = fn(data) if data else zero_gas_dict()
    return results


def calc_seller_net_credits(d: dict) -> dict:
    """
    Seller credit calculation:
    net_credits = (annual_reduction - leakage) * (1 - buffer_percent/100)
    """
    annual_reduction = float(d.get("annual_reduction", 0))
    leakage          = float(d.get("leakage", 0))
    buffer_pct       = float(d.get("buffer_percent", 0))
    net = (annual_reduction - leakage) * (1.0 - buffer_pct / 100.0)
    return {
        "annual_reduction_co2e": annual_reduction,
        "leakage_co2e":          leakage,
        "buffer_reserve_co2e":   net * (buffer_pct / 100.0),
        "net_credits_co2e":      round(max(net, 0), 4),
        "baseline_emission":     float(d.get("baseline_emission", 0)),
        "methodology":           d.get("methodology", ""),
        "standard": "IPCC 2006 + 2019 Refinement | GWP-100 AR5",
    }
