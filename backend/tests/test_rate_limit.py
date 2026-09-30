import asyncio
import pytest
from app.core.rate_limit import LLMRateLimiter, APIRateLimiter, extract_retry_delay


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
    from unittest.mock import MagicMock
    from fastapi import HTTPException

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
