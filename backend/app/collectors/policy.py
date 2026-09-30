from __future__ import annotations

import ipaddress
import logging
import socket
from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

BLOCKED_DOMAINS = frozenset(
    {
        "linkedin.com",
        "www.linkedin.com",
        "facebook.com",
        "www.facebook.com",
        "instagram.com",
        "www.instagram.com",
        "x.com",
        "www.x.com",
        "twitter.com",
        "www.twitter.com",
        "tiktok.com",
        "www.tiktok.com",
        "pinterest.com",
        "www.pinterest.com",
        "reddit.com",
        "www.reddit.com",
    }
)

USER_AGENT = "DataLensBot/1.0 (+https://github.com/datalens)"


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str


_robots_cache: dict[str, RobotFileParser | None] = {}


def _is_private_ip(hostname: str) -> bool:
    """Check if hostname resolves to a private, loopback, link-local, or reserved IP (IPv4 & IPv6)."""
    clean_host = hostname.strip("[]")
    try:
        # Check if hostname is an IP literal
        try:
            ip = ipaddress.ip_address(clean_host)
            return (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            )
        except ValueError:
            pass

        # Resolve all addresses (both IPv4 and IPv6)
        addr_info = socket.getaddrinfo(clean_host, None)
        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            ):
                return True
        return False
    except (socket.gaierror, ValueError):
        return True


async def _fetch_robots(scheme: str, domain: str) -> RobotFileParser | None:
    """Fetch and parse robots.txt for a domain, caching the result."""
    if domain in _robots_cache:
        return _robots_cache[domain]

    robots_url = f"{scheme}://{domain}/robots.txt"
    rp = RobotFileParser()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(robots_url, follow_redirects=True)
            if resp.status_code == 200:
                rp.parse(resp.text.splitlines())
            else:
                rp.allow_all = True
    except httpx.HTTPError:
        rp.allow_all = True

    _robots_cache[domain] = rp
    return rp


async def is_allowed(url: str) -> PolicyDecision:
    """Central gate: decide whether a URL may be fetched."""
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        return PolicyDecision(allowed=False, reason=f"Unsupported scheme: {parsed.scheme}")

    hostname = parsed.hostname or ""
    if not hostname:
        return PolicyDecision(allowed=False, reason="No hostname in URL")

    base_domain = ".".join(hostname.rsplit(".", 2)[-2:])
    if hostname in BLOCKED_DOMAINS or base_domain in BLOCKED_DOMAINS:
        return PolicyDecision(allowed=False, reason=f"Blocked domain: {hostname}")

    if _is_private_ip(hostname):
        return PolicyDecision(allowed=False, reason="Private/loopback/link-local IP")

    rp = await _fetch_robots(parsed.scheme, hostname)
    if rp and not rp.can_fetch(USER_AGENT, url):
        return PolicyDecision(allowed=False, reason="Disallowed by robots.txt")

    return PolicyDecision(allowed=True, reason="OK")


def clear_robots_cache() -> None:
    """Clear the robots.txt cache between runs."""
    _robots_cache.clear()
