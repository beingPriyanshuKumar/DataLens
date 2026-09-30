import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.rate_limit import APIRateLimiter, LLMRateLimiter, extract_retry_delay


def test_extract_retry_delay():
    assert extract_retry_delay("Please retry in 33.95s.") == 33.95
    assert extract_retry_delay("'retryDelay': '48s'") == 48.0
    assert extract_retry_delay("retry after 20 seconds") == 20.0
    assert extract_retry_delay("Some other error without delay") is None


@pytest.mark.asyncio
async def test_llm_rate_limiter_pacing():
    limiter = LLMRateLimiter(min_interval=0.05, max_concurrency=1)
    t0 = asyncio.get_event_loop().time()
    async with limiter:
        pass
    async with limiter:
        pass
    t1 = asyncio.get_event_loop().time()
    # At least min_interval should have elapsed
    assert (t1 - t0) >= 0.04


@pytest.mark.asyncio
async def test_api_rate_limiter():
    limiter = APIRateLimiter(requests_per_minute=2)
    mock_req = MagicMock()
    mock_req.client.host = "1.2.3.4"

    # 1st and 2nd should pass
    await limiter.check(mock_req)
    await limiter.check(mock_req)

    # 3rd should raise 429
    with pytest.raises(HTTPException) as exc_info:
        await limiter.check(mock_req)
    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_api_rate_limiter_proxy_headers():
    limiter = APIRateLimiter(requests_per_minute=5)
    mock_req = MagicMock()
    mock_req.client.host = "10.0.0.1"  # Internal proxy IP
    mock_req.headers = {"x-forwarded-for": "198.51.100.42, 10.0.0.1"}

    await limiter.check(mock_req)
    assert "198.51.100.42" in limiter.history
    assert "10.0.0.1" not in limiter.history


@pytest.mark.asyncio
async def test_api_rate_limiter_evicts_stale_ips():
    import time

    limiter = APIRateLimiter(requests_per_minute=10)
    mock_req = MagicMock()
    mock_req.client.host = "1.2.3.4"
    mock_req.headers = {}

    await limiter.check(mock_req)
    assert "1.2.3.4" in limiter.history

    # Artificially age the timestamp past window using monotonic time
    limiter.history["1.2.3.4"] = [time.monotonic() - 100.0]
    limiter._last_prune = 0.0  # Force pruning cycle on next check

    # Next check from another IP triggers prune
    mock_req2 = MagicMock()
    mock_req2.client.host = "5.6.7.8"
    mock_req2.headers = {}
    await limiter.check(mock_req2)

    assert "1.2.3.4" not in limiter.history
    assert "5.6.7.8" in limiter.history
