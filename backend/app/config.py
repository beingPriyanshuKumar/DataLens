from __future__ import annotations

import logging
from typing import Literal

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # LLM provider: "anthropic" or "gemini"
    llm_provider: Literal["anthropic", "gemini"] = "gemini"

    # Provider API keys (one must be set for the chosen provider)
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Model IDs — defaults vary by provider; overridden in .env
    spec_model: str = ""
    extract_model: str = ""

    # Search provider: "tavily" or "ddg"
    search_provider: Literal["tavily", "ddg"] = "ddg"
    tavily_api_key: str = ""

    # Database
    database_url: str = "sqlite:///./datalens.db"

    # Pipeline limits: default to 8 pages per run to conserve LLM quota while hitting targets
    max_pages_per_run: int = 8
    fetch_concurrency: int = 5
    per_domain_delay_seconds: float = 2.0
    run_timeout_seconds: int = 600
    max_concurrent_runs: int = 2
    trusted_proxies: str = ""

    # Rate limits & pacing: 60 rpm for user HTTP requests, 0.5s interval for fast planning
    llm_min_interval_seconds: float = 0.5
    llm_concurrency: int = 2
    api_rate_limit_per_minute: int = 60

    # CORS (comma-separated origins)
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def get_spec_model(self) -> str:
        """Return the configured spec model, or provider default."""
        if self.spec_model:
            return self.spec_model
        if self.llm_provider == "gemini":
            return "gemini-3.5-flash-lite"
        return "claude-sonnet-4-20250514"

    def get_extract_model(self) -> str:
        """Return the configured extract model, or provider default."""
        if self.extract_model:
            return self.extract_model
        if self.llm_provider == "gemini":
            return "gemini-3.5-flash-lite"
        return "claude-sonnet-4-20250514"

    def get_cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def get_active_llm_key(self) -> str:
        """Return the API key for the active LLM provider."""
        if self.llm_provider == "gemini":
            return self.gemini_api_key
        return self.anthropic_api_key

    def get_search_provider(self) -> str:
        """Auto-detect search provider: use tavily if key is set, otherwise ddg."""
        if self.tavily_api_key and self.tavily_api_key.strip():
            return "tavily"
        return "ddg"


settings = Settings()

# Startup readiness log (no secrets)
_llm_key_present = bool(settings.get_active_llm_key())
_search_prov = settings.get_search_provider()
logger.info(
    "READY: llm=%s(%s, key=%s) search=%s db=%s",
    settings.llm_provider,
    settings.get_spec_model(),
    "ok" if _llm_key_present else "MISSING",
    _search_prov,
    "ok",
)
if not _llm_key_present:
    logger.warning(
        "No LLM API key configured for provider '%s'. Set %s in backend/.env and restart.",
        settings.llm_provider,
        "GEMINI_API_KEY" if settings.llm_provider == "gemini" else "ANTHROPIC_API_KEY",
    )
