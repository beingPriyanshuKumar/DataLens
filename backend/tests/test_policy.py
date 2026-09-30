from unittest.mock import AsyncMock, patch
from urllib.robotparser import RobotFileParser

import pytest

from app.collectors.policy import is_allowed


@pytest.mark.asyncio
async def test_policy_blocked_domains():
    urls = [
        "https://linkedin.com/in/john-doe",
        "https://www.linkedin.com/jobs/view/123",
        "https://facebook.com/profile",
        "https://www.instagram.com/p/abc",
        "https://twitter.com/user/status/1",
        "https://x.com/user",
        "https://www.reddit.com/r/python",
    ]
    for url in urls:
        decision = await is_allowed(url)
        assert decision.allowed is False
        assert "Blocked domain" in decision.reason


@pytest.mark.asyncio
async def test_policy_unsupported_scheme():
    urls = [
        "ftp://example.com/files",
        "file:///etc/passwd",
        "data:text/html,hello",
    ]
    for url in urls:
        decision = await is_allowed(url)
        assert decision.allowed is False
        assert "Unsupported scheme" in decision.reason


@pytest.mark.asyncio
async def test_policy_private_ip():
    urls = [
        "http://127.0.0.1/admin",
        "http://192.168.1.1/dashboard",
        "http://10.0.0.1/secret",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/status",
        "http://[fe80::1]/config",
    ]
    for url in urls:
        decision = await is_allowed(url)
        assert decision.allowed is False
        assert "Private/loopback/link-local IP" in decision.reason


@pytest.mark.asyncio
async def test_policy_allowed_public_url():
    rp = RobotFileParser()
    rp.allow_all = True

    with (
        patch("app.collectors.policy._is_private_ip", return_value=False),
        patch("app.collectors.policy._fetch_robots", new=AsyncMock(return_value=rp)),
    ):
        decision = await is_allowed("https://example.com/blog/article-1")
        assert decision.allowed is True
        assert decision.reason == "OK"


@pytest.mark.asyncio
async def test_policy_robots_disallow():
    rp = RobotFileParser()
    rp.parse(
        [
            "User-agent: *",
            "Disallow: /private/",
        ]
    )

    with (
        patch("app.collectors.policy._is_private_ip", return_value=False),
        patch("app.collectors.policy._fetch_robots", new=AsyncMock(return_value=rp)),
    ):
        decision = await is_allowed("https://example.com/private/data")
        assert decision.allowed is False
        assert "Disallowed by robots.txt" in decision.reason
