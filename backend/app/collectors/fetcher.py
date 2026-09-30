from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx
import trafilatura

from app.collectors.policy import USER_AGENT, is_allowed
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_TEXT_CHARS = 32_000
MIN_TEXT_CHARS = 80
MAX_REDIRECTS = 3

DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


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
    """Extract main content text from HTML using trafilatura with fallback."""
    text = trafilatura.extract(html, url=url, include_links=False, include_tables=True)
    if not text or len(text.strip()) < MIN_TEXT_CHARS:
        text = trafilatura.html2txt(html)
    if not text or len(text.strip()) < 50:
        return None
    return text[:MAX_TEXT_CHARS]


async def fetch_page(url: str) -> FetchedPage | FetchError:
    """Fetch a single page with rate limiting, concurrency control, and content extraction.

    Enforces SSRF validation on every redirect step to prevent open-redirect attacks.
    Uses streaming chunk reads to cap memory usage (PERF-002).
    """
    domain = urlparse(url).hostname or ""
    sem = _get_semaphore()

    async with sem:
        await _wait_for_domain(domain)

        max_retries = 2
        last_error = ""

        for attempt in range(max_retries + 1):
            try:
                current_url = url
                current_domain = domain

                async with httpx.AsyncClient(
                    timeout=15,
                    follow_redirects=False,
                    headers=DEFAULT_HEADERS,
                ) as client:
                    for _ in range(MAX_REDIRECTS + 1):
                        req = client.build_request("GET", current_url)
                        resp = await client.send(req, stream=True)

                        if resp.is_redirect:
                            location = resp.headers.get("location")
                            await resp.aclose()
                            if not location:
                                break
                            next_url = urljoin(current_url, location)

                            # Validate redirect target against SSRF and domain policies
                            decision = await is_allowed(next_url)
                            if not decision.allowed:
                                return FetchError(
                                    url=current_url,
                                    domain=current_domain,
                                    http_status=resp.status_code,
                                    reason=f"Redirect blocked: {decision.reason} ({next_url})",
                                )

                            current_url = next_url
                            current_domain = urlparse(next_url).hostname or current_domain
                            continue

                        # Not a redirect: process the streamed body
                        try:
                            if resp.status_code >= 400:
                                await resp.aclose()
                                if resp.status_code >= 500 and attempt < max_retries:
                                    await asyncio.sleep(2**attempt)
                                    break
                                return FetchError(
                                    url=current_url,
                                    domain=current_domain,
                                    http_status=resp.status_code,
                                    reason=f"HTTP {resp.status_code}",
                                )

                            content_type = resp.headers.get("content-type", "")
                            if "text/html" not in content_type:
                                await resp.aclose()
                                return FetchError(
                                    url=current_url,
                                    domain=current_domain,
                                    http_status=resp.status_code,
                                    reason=f"Not HTML: {content_type}",
                                )

                            chunks: list[bytes] = []
                            total_bytes = 0
                            async for chunk in resp.aiter_bytes():
                                total_bytes += len(chunk)
                                chunks.append(chunk)
                                if total_bytes >= MAX_RESPONSE_BYTES:
                                    break

                            encoding = resp.encoding or "utf-8"
                            raw_bytes = b"".join(chunks)
                            html = raw_bytes.decode(encoding, errors="replace")
                        finally:
                            await resp.aclose()

                        text = _extract_text(html, current_url)
                        if text is None:
                            return FetchError(
                                url=current_url,
                                domain=current_domain,
                                http_status=resp.status_code,
                                reason="Insufficient text content after extraction",
                            )

                        return FetchedPage(
                            url=current_url,
                            domain=current_domain,
                            http_status=resp.status_code,
                            text=text,
                        )

            except TimeoutError:
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
