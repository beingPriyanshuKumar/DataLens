"""Search layer: supports Tavily (keyed) and DuckDuckGo (keyless fallback).

This is the ONLY module that imports a search SDK.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"


@dataclass
class SearchResult:
    url: str
    title: str
    snippet: str


def _normalize_url(url: str) -> str:
    """Strip tracking params and fragments for deduplication."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    cleaned = {k: v for k, v in params.items() if not k.startswith("utm_")}
    return urlunparse(
        parsed._replace(
            query=urlencode(cleaned, doseq=True),
            fragment="",
        )
    )


# ---------------------------------------------------------------------------
# Tavily provider
# ---------------------------------------------------------------------------

async def _search_tavily(query: str, limit: int = 10) -> list[SearchResult]:
    """Search via Tavily API."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": limit,
                    "search_depth": "basic",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("Tavily search failed for query '%s': %s", query, exc)
        return []

    results: list[SearchResult] = []
    seen_urls: set[str] = set()
    for item in data.get("results", []):
        url = _normalize_url(item.get("url", ""))
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        results.append(
            SearchResult(
                url=url,
                title=item.get("title", ""),
                snippet=item.get("content", ""),
            )
        )

    logger.info("Tavily: query='%s' → %d results", query, len(results))
    return results


# ---------------------------------------------------------------------------
# DuckDuckGo provider (keyless)
# ---------------------------------------------------------------------------

async def _search_ddg(query: str, limit: int = 10) -> list[SearchResult]:
    """Search via DuckDuckGo (no API key required)."""
    import asyncio

    raw: list[dict] = []
    for attempt in range(2):
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS  # type: ignore

            def _do_search() -> list[dict]:
                with DDGS() as ddgs:
                    return list(ddgs.text(query, max_results=limit))

            raw = await asyncio.to_thread(_do_search)
            if raw:
                break
            if attempt == 0:
                await asyncio.sleep(1.0)
        except Exception as exc:
            if attempt == 0:
                logger.warning(
                    "DuckDuckGo search attempt 0 failed for query '%s': %s, retrying in 1.5s...",
                    query,
                    exc,
                )
                await asyncio.sleep(1.5)
                continue
            logger.error("DuckDuckGo search failed for query '%s': %s", query, exc)
            return []

    results: list[SearchResult] = []
    seen_urls: set[str] = set()
    for item in raw:
        url = _normalize_url(item.get("href", item.get("link", "")))
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        results.append(
            SearchResult(
                url=url,
                title=item.get("title", ""),
                snippet=item.get("body", ""),
            )
        )

    logger.info("DuckDuckGo: query='%s' → %d results", query, len(results))
    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def search(query: str, limit: int = 10) -> list[SearchResult]:
    """Search using the configured provider."""
    provider = settings.get_search_provider()
    if provider == "tavily":
        return await _search_tavily(query, limit)
    return await _search_ddg(query, limit)


async def search_multiple(queries: list[str], limit_per_query: int = 10) -> list[SearchResult]:
    """Run multiple search queries and deduplicate across all results."""
    import asyncio

    all_results: list[SearchResult] = []
    seen_urls: set[str] = set()

    for idx, query in enumerate(queries):
        if idx > 0 and settings.get_search_provider() == "ddg":
            await asyncio.sleep(1.0)  # Pacing between DDG queries to prevent IP throttling
        results = await search(query, limit=limit_per_query)
        for r in results:
            if r.url not in seen_urls:
                seen_urls.add(r.url)
                all_results.append(r)

    provider = settings.get_search_provider()
    logger.info(
        "Search complete: %d queries via %s → %d unique URLs",
        len(queries), provider, len(all_results),
    )

    return all_results


_search_health_cached: dict | None = None


async def check_search_health() -> dict:
    """Verify search is configured and operational without spamming live search on every tick."""
    global _search_health_cached
    if _search_health_cached is not None:
        return _search_health_cached

    provider = settings.get_search_provider()
    try:
        if provider == "tavily":
            if not settings.tavily_api_key:
                return {"provider": "tavily", "ok": False, "error": "Missing TAVILY_API_KEY", "note": None}
            await search("test", limit=1)
            res = {"provider": "tavily", "ok": True, "error": None, "note": None}
        else:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS  # type: ignore
            res = {
                "provider": "ddg",
                "ok": True,
                "error": None,
                "note": "Using keyless DuckDuckGo search",
            }
        _search_health_cached = res
        return res
    except Exception as exc:
        return {"provider": provider, "ok": False, "error": str(exc), "note": None}
