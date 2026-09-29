from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
import trafilatura

from app.collectors.policy import USER_AGENT
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_TEXT_CHARS = 12_000
MIN_TEXT_CHARS = 200


@dataclass
class FetchedPage:
    url: str
    domain: str
    http_status: int
    text: str


@dataclass
class FetchError:
    url: str
    domain: str
    http_status: int | None
    reason: str


_domain_last_fetch: dict[str, float] = {}
_domain_lock = asyncio.Lock()
_global_semaphore: asyncio.Semaphore | None = None


def _get_semaphore() -> asyncio.Semaphore:
    global _global_semaphore
    if _global_semaphore is None:
        _global_semaphore = asyncio.Semaphore(settings.fetch_concurrency)
    return _global_semaphore


async def _wait_for_domain(domain: str) -> None:
    """Enforce per-domain rate limiting."""
    delay = settings.per_domain_delay_seconds
    async with _domain_lock:
        last = _domain_last_fetch.get(domain, 0)
        wait = delay - (time.monotonic() - last)
        if wait > 0:
            await asyncio.sleep(wait)
        _domain_last_fetch[domain] = time.monotonic()


def _extract_text(html: str, url: str) -> str | None:
    """Extract main content text from HTML using trafilatura."""
    text = trafilatura.extract(html, url=url, include_links=False, include_tables=True)
    if not text or len(text) < MIN_TEXT_CHARS:
        return None
    return text[:MAX_TEXT_CHARS]


async def fetch_page(url: str) -> FetchedPage | FetchError:
    """Fetch a single page with rate limiting, concurrency control, and content extraction."""
    domain = urlparse(url).hostname or ""
    sem = _get_semaphore()

    async with sem:
        await _wait_for_domain(domain)

        max_retries = 2
        last_error = ""

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=15,
                    follow_redirects=True,
                    max_redirects=3,
                    headers={"User-Agent": USER_AGENT},
                ) as client:
                    resp = await client.get(url)

                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type:
                    return FetchError(
                        url=url,
                        domain=domain,
                        http_status=resp.status_code,
                        reason=f"Not HTML: {content_type}",
                    )

                if resp.status_code >= 400:
                    if resp.status_code >= 500 and attempt < max_retries:
                        await asyncio.sleep(2**attempt)
                        continue
                    return FetchError(
                        url=url,
                        domain=domain,
                        http_status=resp.status_code,
                        reason=f"HTTP {resp.status_code}",
                    )

                html = resp.text[:MAX_RESPONSE_BYTES]
                text = _extract_text(html, url)
                if text is None:
                    return FetchError(
                        url=url,
                        domain=domain,
                        http_status=resp.status_code,
                        reason="Insufficient text content after extraction",
                    )

                return FetchedPage(url=url, domain=domain, http_status=resp.status_code, text=text)

            except httpx.TimeoutException:
                last_error = "Timeout"
                if attempt < max_retries:
                    await asyncio.sleep(2**attempt)
                    continue
            except httpx.HTTPError as exc:
                last_error = str(exc)
                if attempt < max_retries:
                    await asyncio.sleep(2**attempt)
                    continue

        return FetchError(url=url, domain=domain, http_status=None, reason=last_error)
