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


async def search(query: str, limit: int = 10) -> list[SearchResult]:
    """Search via Tavily API and return deduplicated results."""
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

    return results


async def search_multiple(queries: list[str], limit_per_query: int = 10) -> list[SearchResult]:
    """Run multiple search queries and deduplicate across all results."""
    all_results: list[SearchResult] = []
    seen_urls: set[str] = set()

    for query in queries:
        results = await search(query, limit=limit_per_query)
        for r in results:
            if r.url not in seen_urls:
                seen_urls.add(r.url)
                all_results.append(r)

    return all_results
