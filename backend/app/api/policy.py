from __future__ import annotations

from fastapi import APIRouter
from app.collectors.fetcher import MAX_RESPONSE_BYTES
from app.collectors.policy import BLOCKED_DOMAINS, USER_AGENT
from app.config import settings
from app.schemas import PolicyResponse

router = APIRouter(tags=["policy"])


@router.get("/policy")
async def get_policy_facts() -> PolicyResponse:
    """Return non-sensitive policy facts used by the Trust page (Phase 4.2)."""
    return PolicyResponse(
        user_agent=USER_AGENT,
        honors_robots_txt=True,
        blocked_categories=[
            "Login-walled social networks & platforms",
            "Private, loopback, link-local, and reserved IP ranges",
            "Non-HTTP/HTTPS protocols",
        ],
        blocked_domains=sorted(list(BLOCKED_DOMAINS)),
        per_domain_delay_seconds=settings.per_domain_delay_seconds,
        max_pages_per_run=settings.max_pages_per_run,
        max_response_bytes=MAX_RESPONSE_BYTES,
        max_concurrent_runs=settings.max_concurrent_runs,
    )
