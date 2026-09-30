"""System diagnostics endpoint: GET /api/diagnostics.

Reports health of database, LLM, and search with real tiny checks.
Results are cached for 60 seconds.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["diagnostics"])

_cache: dict | None = None
_cache_ts: float = 0.0
CACHE_TTL = 60.0


async def _check_database() -> dict:
    """Verify database is accessible."""
    try:
        from sqlalchemy import text

        from app.db import async_session

        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@router.get("/diagnostics")
async def get_diagnostics() -> dict:
    """Return system health check.

    Each component is tested with a real, tiny call.
    Results are cached for 60 seconds.
    """
    global _cache, _cache_ts

    now = time.time()
    if _cache is not None and (now - _cache_ts) < CACHE_TTL:
        return _cache

    from app.collectors.search import check_search_health
    from app.core.llm import check_llm_health

    db_result = await _check_database()
    llm_result = await check_llm_health()
    search_result = await check_search_health()

    # Enrich LLM result with model info
    llm_result["spec_model"] = settings.get_spec_model()
    llm_result["extract_model"] = settings.get_extract_model()

    result = {
        "database": db_result,
        "llm": llm_result,
        "search": search_result,
        "version": "0.1.0",
    }

    _cache = result
    _cache_ts = now

    # Log summary
    logger.info(
        "Diagnostics: db=%s llm=%s(%s) search=%s(%s)",
        "ok" if db_result["ok"] else "FAIL",
        "ok" if llm_result["ok"] else "FAIL",
        llm_result.get("provider", "?"),
        "ok" if search_result["ok"] else "FAIL",
        search_result.get("provider", "?"),
    )

    return result
