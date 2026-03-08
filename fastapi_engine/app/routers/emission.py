"""
routers/emission.py
────────────────────
POST /api/v1/emission/calculate  — Buyer scope 1/2/3 emission calculation
POST /api/v1/seller/calculate    — Seller net credit calculation
GET  /api/v1/dashboard/summary   — Yearly trend data for line graph
GET  /api/v1/dashboard/region    — Regional aggregation for bar graph

All calculations use IPCC GWP-100 AR5 (CO2=1, CH4=28, N2O=265, HFC134a=1300, SF6=23500).
Scientific logic delegated to services/emission.py, absorption.py, aggregation.py (UNCHANGED).
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.aggregation import (
    GWP, zero_gas_dict, accumulate_gases, to_co2e, aggregate_results,
    m2_to_hectare, litres_to_tonne_fuel, kg_to_tonnes
)
from app.core.ef_registry import (
    lookup_industry_ef, lookup_vehicle_ef, lookup_aviation_ef, lookup_ippu_ef,
    AVIATION_EF_GENERIC, IPPU_EF_GENERIC
)
import logging

router = APIRouter()

# ─────────────────────────────────────────────────────────────
# SCOPE INPUT SCHEMAS
# ─────────────────────────────────────────────────────────────

class Scope1Input(BaseModel):
    fuel_type: str = Field(..., description="coal / diesel / natural_gas")
    fuel_unit: str = Field(..., description="tonnes / litres")
    fuel_quantity: float = Field(..., ge=0)
    number_of_factories: int = Field(..., ge=1)
    industry_type: Optional[str] = "cement"
    manufacturing_category: Optional[str] = "medium"

class Scope2Input(BaseModel):
    electricity_kwh: float = Field(..., ge=0)
    grid_emission_factor: float = Field(0.82, ge=0,
        description="kg CO2e per kWh. Default 0.82 (India avg). User can override.")

class Scope3Input(BaseModel):
    transportation_co2e: float = Field(0.0, ge=0, description="t CO2e")
    waste_co2e: float = Field(0.0, ge=0, description="t CO2e")

class EmissionCalculateRequest(BaseModel):
    project_id: str
    scope1: Optional[Scope1Input] = None
    scope2: Optional[Scope2Input] = None
    scope3: Optional[Scope3Input] = None
    # Absorption (optional — for net balance)
    forest_area_m2: Optional[float] = Field(None, ge=0)
    tree_count: Optional[int] = Field(None, ge=0)
    other_absorption_co2e: Optional[float] = Field(None, ge=0)

class SellerCalculateRequest(BaseModel):
    baseline_emission: float = Field(..., ge=0, description="t CO2e/yr")
    annual_reduction: float = Field(..., ge=0, description="t CO2e/yr")
    leakage: float = Field(0.0, ge=0, description="t CO2e/yr")
    buffer_percent: float = Field(10.0, ge=0, le=100)

# ─────────────────────────────────────────────────────────────
# STUBBLE EF (IPCC 2006 Vol.4 Table 2.5)
# ─────────────────────────────────────────────────────────────
_STUBBLE_EF = {"CO2": 5.5700, "CH4": 0.2740, "N2O": 0.006830}


# ─────────────────────────────────────────────────────────────
# POST /api/v1/emission/calculate
# ─────────────────────────────────────────────────────────────
@router.post("/emission/calculate")
async def calculate_emission(req: EmissionCalculateRequest):
    
    logger = logging.getLogger("uvicorn.error")
    logger.setLevel(logging.DEBUG)   
    
    logger.debug("DEBUG REQUEST: %s", req)
    """
    3-scope emission calculation.
    Scope 1: Stationary combustion (fuel × EF per gas)
    Scope 2: Purchased electricity (kWh × grid EF)
    Scope 3: Transportation + waste (direct CO2e input)
    All converted to t CO2e using GWP-100 AR5.
    """
    emission_gas_dicts: dict = {}

    # ── SCOPE 1 ──────────────────────────────────────────────
    scope1_co2e = 0.0
    if req.scope1:
        s = req.scope1
        # Convert fuel to tonnes
        if s.fuel_unit == "litres":
            fuel_t = litres_to_tonne_fuel(s.fuel_quantity, s.fuel_type)
        else:
            fuel_t = s.fuel_quantity
        total_fuel = fuel_t * s.number_of_factories
        ef = lookup_industry_ef(
            s.industry_type or "cement",
            s.manufacturing_category or "medium",
            s.fuel_type
        )
        g = {
            "CO2": total_fuel * ef["CO2"],
            "CH4": total_fuel * ef["CH4"],
            "N2O": total_fuel * ef["N2O"],
            "HFC134a": 0.0, "SF6": 0.0,
        }
        scope1_co2e = to_co2e(g)
        emission_gas_dicts["scope1"] = g

    # ── SCOPE 2 ──────────────────────────────────────────────
    scope2_co2e = 0.0
    if req.scope2:
        # kWh × grid_ef (kg CO2e/kWh) ÷ 1000 → t CO2e
        scope2_co2e = (req.scope2.electricity_kwh * req.scope2.grid_emission_factor) / 1000.0
        emission_gas_dicts["scope2"] = {
            "CO2": scope2_co2e, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0
        }

    # ── SCOPE 3 ──────────────────────────────────────────────
    scope3_co2e = 0.0
    if req.scope3:
        scope3_co2e = req.scope3.transportation_co2e + req.scope3.waste_co2e
        emission_gas_dicts["scope3"] = {
            "CO2": scope3_co2e, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0
        }

    # ── ABSORPTION ───────────────────────────────────────────
    absorption_gas_dicts: dict = {}
    if req.forest_area_m2:
        co2 = m2_to_hectare(req.forest_area_m2) * 12.0
        absorption_gas_dicts["forest"] = {"CO2": co2, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}
    if req.tree_count:
        co2 = req.tree_count * 0.02
        absorption_gas_dicts["trees"] = {"CO2": co2, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}
    if req.other_absorption_co2e:
        absorption_gas_dicts["other"] = {"CO2": req.other_absorption_co2e, "CH4": 0.0, "N2O": 0.0, "HFC134a": 0.0, "SF6": 0.0}

    # ── AGGREGATE ────────────────────────────────────────────
    agg = aggregate_results(emission_gas_dicts, absorption_gas_dicts)

    return {
        **agg,
        "scope1_co2e": round(scope1_co2e, 6),
        "scope2_co2e": round(scope2_co2e, 6),
        "scope3_co2e": round(scope3_co2e, 6),
        "credits_required": max(0.0, round(agg["net_balance"], 4)),
        "scientific_standard": "IPCC 2006 + 2019 Refinement | GWP-100 AR5",
    }


# ─────────────────────────────────────────────────────────────
# POST /api/v1/seller/calculate
# ─────────────────────────────────────────────────────────────
@router.post("/seller/calculate")
async def calculate_seller(req: SellerCalculateRequest):
    """
    Net Credit Calculation for Sellers.
    Net Credits = (annual_reduction − leakage) × (1 − buffer_percent/100)
    All values in t CO2e (IPCC Tier 1 basis).
    """
    net_reduction = req.annual_reduction - req.leakage
    net_credits = net_reduction * (1 - req.buffer_percent / 100)
    additionality = req.annual_reduction - req.baseline_emission
    return {
        "baseline_emission_co2e": req.baseline_emission,
        "annual_reduction_co2e": req.annual_reduction,
        "leakage_co2e": req.leakage,
        "buffer_percent": req.buffer_percent,
        "net_reduction_co2e": round(net_reduction, 6),
        "net_credits_available": round(max(0, net_credits), 6),
        "additionality_co2e": round(additionality, 6),
        "formula": "Net Credits = (annual_reduction - leakage) × (1 - buffer%/100)",
        "scientific_standard": "IPCC 2006 + 2019 Refinement | GWP-100 AR5",
    }


# ─────────────────────────────────────────────────────────────
# GET /api/v1/dashboard/summary
# ─────────────────────────────────────────────────────────────
@router.get("/dashboard/summary")
async def dashboard_summary(    
    country: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
):    
    
    """
    Returns yearly trend data for line graph.
    Aggregated from vw_yearly_trend view (via Node.js DB call in production).
    FastAPI returns normalized CO2e values for plotting.
    """
    # In production this queries PostgreSQL via SQLAlchemy.
    # Returning structure contract for frontend:
    return {
        "yearly_trend": [
            {"year": 2020, "emission_co2e": 0, "absorption_co2e": 0, "credits_traded": 0},
        ],
        "top_indicators": {
            "absorption_pct": 0.0,
            "emission_pct": 100.0,
        },
        "unit": "t CO2e",
        "gwp_basis": "AR5 GWP-100 | CO2=1 CH4=28 N2O=265 HFC134a=1300 SF6=23500",
    }


# ─────────────────────────────────────────────────────────────
# GET /api/v1/dashboard/region
# ─────────────────────────────────────────────────────────────
@router.get("/dashboard/region")
async def dashboard_region(
    country: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
):
    """
    Regional aggregation for bar graph.
    Resolution: country → state → district (based on what's provided).
    """
    return {
        "regions": [],
        "resolution": "district" if district else "state" if state else "country",
        "unit": "t CO2e",
    }
