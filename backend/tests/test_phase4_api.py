import pytest
import httpx
from app.main import app
from app.regions import SUPPORTED_REGIONS


@pytest.mark.asyncio
async def test_get_regions():
    """GET /api/regions returns list of supported regions."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/regions")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 12
        codes = [r["code"] for r in data]
        assert "GLOBAL" in codes
        assert "IN" in codes
        assert "US" in codes


@pytest.mark.asyncio
async def test_get_policy():
    """GET /api/policy returns public policy facts for the Trust page."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/policy")
        assert resp.status_code == 200
        data = resp.json()
        assert "DataLensBot" in data["user_agent"]
        assert data["honors_robots_txt"] is True
        assert len(data["blocked_domains"]) > 0
        assert data["max_concurrent_runs"] >= 1
        assert data["max_pages_per_run"] >= 1


@pytest.mark.asyncio
async def test_security_headers_present():
    """OPS-001 / F-07: Security headers are present on API responses."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "default-src 'none'" in resp.headers.get("Content-Security-Policy", "")


@pytest.mark.asyncio
async def test_spoofed_x_forwarded_for_ignored():
    """VULN-003 / F-06: Untrusted X-Forwarded-For header is ignored by rate limiter."""
    from app.core.rate_limit import APIRateLimiter
    from fastapi import Request

    limiter = APIRateLimiter(requests_per_minute=5)
    
    # Mock request from untrusted client host
    scope = {
        "type": "http",
        "client": ("192.168.1.50", 12345),
        "headers": [
            (b"x-forwarded-for", b"8.8.8.8"),
            (b"host", b"localhost"),
        ],
    }
    req = Request(scope)
    extracted_ip = limiter._extract_ip(req)
    # Since 192.168.1.50 is not in trusted_proxies, it should return client host, NOT 8.8.8.8
    assert extracted_ip == "192.168.1.50"
