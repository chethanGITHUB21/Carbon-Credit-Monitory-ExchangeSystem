"""
FastAPI Carbon Accounting Engine — Main Entry Point
Standards: IPCC 2006 + 2019 Refinement | GWP-100 AR5 | Tier 1
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers.emission import router as emission_router

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="IPCC Tier 1 Carbon Accounting Engine | GWP-100 AR5",
    docs_url="/docs",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Include all routers
app.include_router(emission_router, prefix="/api/v1", tags=["Carbon Engine"])

@app.get("/")
async def root():
    return {
        "service": settings.APP_TITLE,
        "version": settings.APP_VERSION,
        "standards": "IPCC 2006 + 2019 Refinement | GWP-100 AR5 | Tier 1",
        "gwp": {"CO2": 1, "CH4": 28, "N2O": 265, "HFC134a": 1300, "SF6": 23500},
    }
