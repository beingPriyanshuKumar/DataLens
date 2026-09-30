from __future__ import annotations

import asyncio
import logging
import re
import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.config import settings

logger = logging.getLogger(__name__)


def extract_retry_delay(error_message: str) -> float | None:
    """Extract recommended retry delay (in seconds) from provider error messages.

    Examples:
      - 'Please retry in 33.952229313s.'
      - \"'retryDelay': '33s'\"
      - 'retry after 20 seconds'
    """
    # Pattern 1: Please retry in X.Xs
    m = re.search(r"retry in (\d+(?:\.\d+)?)s", error_message, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    # Pattern 2: 'retryDelay': '20s' or "retryDelay": "20s"
    m = re.search(r"retryDelay[\'\":\s]+(\d+(?:\.\d+)?)", error_message, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    # Pattern 3: retry after X seconds
    m = re.search(r"retry after (\d+(?:\.\d+)?)", error_message, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


class LLMRateLimiter:
    """Paces outgoing LLM requests to stay within provider limits (e.g. Gemini 15 RPM).

    Enforces minimum delay between consecutive calls and caps concurrency.
    """

    def __init__(self, min_interval: float | None = None, max_concurrency: int | None = None):
        self.min_interval = min_interval or getattr(settings, "llm_min_interval_seconds", 4.0)
        self.max_concurrency = max_concurrency or getattr(settings, "llm_concurrency", 1)
        self._lock = asyncio.Lock()
        self._last_call_time: float = 0.0
        self._semaphore = asyncio.Semaphore(self.max_concurrency)

    async def acquire(self) -> None:
        """Wait for a concurrency slot and ensure min_interval spacing between calls."""
        await self._semaphore.acquire()
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_call_time
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                logger.info("LLM rate limiter: pacing request (waiting %.2fs)", wait_time)
                await asyncio.sleep(wait_time)
            self._last_call_time = time.monotonic()

    def release(self) -> None:
        """Release concurrency slot."""
        self._semaphore.release()

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.release()


class APIRateLimiter:
    """In-memory sliding window rate limiter for FastAPI HTTP endpoints.

    Prevents user flooding, double-clicking, and automated scraping.
    Includes proxy header resolution and automatic memory leak eviction.
    """

    def __init__(self, requests_per_minute: int | None = None):
        self.rpm = requests_per_minute or getattr(settings, "api_rate_limit_per_minute", 60)
        self.history: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._last_prune: float = time.monotonic()

    def _extract_ip(self, request: Request) -> str:
        """Extract client IP, inspecting proxy headers ONLY if request comes from a trusted proxy."""
        client_host = request.client.host if request.client else "unknown"
        trusted = [
            p.strip() for p in getattr(settings, "trusted_proxies", "").split(",") if p.strip()
        ]
        if trusted and client_host in trusted:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                client = forwarded.split(",")[0].strip()
                if client:
                    return client
            real_ip = request.headers.get("x-real-ip")
            if real_ip and real_ip.strip():
                return real_ip.strip()
        return client_host

    def _prune_expired(self, cutoff: float) -> None:
        """Evict stale IP entries to prevent monotonically growing memory leaks."""
        stale_ips = [ip for ip, ts in self.history.items() if not ts or ts[-1] <= cutoff]
        for ip in stale_ips:
            self.history.pop(ip, None)

    async def check(self, request: Request) -> None:
        """Validate request against IP-based rate limit."""
        client_ip = self._extract_ip(request)
        now = time.monotonic()
        cutoff = now - 60.0

        async with self._lock:
            # Periodic pruning every 60 seconds
            if now - self._last_prune > 60.0:
                self._prune_expired(cutoff)
                self._last_prune = now

            timestamps = [t for t in self.history[client_ip] if t > cutoff]
            if len(timestamps) >= self.rpm:
                oldest = timestamps[0]
                retry_after = max(1, int(60.0 - (now - oldest)))
                logger.warning(
                    "API rate limit exceeded for %s (%d reqs in 60s). Retry after %ds",
                    client_ip,
                    len(timestamps),
                    retry_after,
                )
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please wait {retry_after} seconds before trying again.",
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            self.history[client_ip] = timestamps


# Global instances
llm_limiter = LLMRateLimiter()
api_limiter = APIRateLimiter()
