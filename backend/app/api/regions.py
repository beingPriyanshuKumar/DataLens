from __future__ import annotations

from fastapi import APIRouter

from app.regions import SUPPORTED_REGIONS, Region

router = APIRouter(tags=["regions"])


@router.get("/regions")
async def list_regions() -> list[Region]:
    """Return the constant list of supported regions (Phase 4.1)."""
    return SUPPORTED_REGIONS
