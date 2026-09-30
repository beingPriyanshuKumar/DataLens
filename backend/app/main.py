import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import create_all

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    await create_all()
    from app.core.runner import mark_stale_runs

    await mark_stale_runs()

    # Startup readiness summary (no secrets)
    llm_key_ok = bool(settings.get_active_llm_key())
    search_prov = settings.get_search_provider()
    logger.info(
        "READY: llm=%s(key=%s) search=%s db=ok",
        settings.llm_provider,
        "ok" if llm_key_ok else "MISSING",
        search_prov,
    )
    if not llm_key_ok:
        logger.warning(
            "⚠ No LLM API key for '%s'. Set %s in backend/.env and restart.",
            settings.llm_provider,
            "GEMINI_API_KEY" if settings.llm_provider == "gemini" else "ANTHROPIC_API_KEY",
        )
    yield


app = FastAPI(title="DataLens", version="0.1.0", lifespan=lifespan)

# CORS from config (not hardcoded)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


from fastapi.responses import JSONResponse  # noqa: E402
from app.core.llm import LLMError  # noqa: E402


@app.exception_handler(LLMError)
async def llm_error_handler(_request, exc: LLMError):
    msg = str(exc)
    if "RESOURCE_EXHAUSTED" in msg or "429" in msg:
        return JSONResponse(
            status_code=429,
            content={
                "detail": (
                    "Gemini API rate limit reached (free-tier quota: 20 requests). "
                    "Please wait 30 seconds and try again."
                )
            },
        )
    return JSONResponse(
        status_code=502,
        content={"detail": f"AI generation error: {msg}"},
    )


from app.api import diagnostics, exports, records, reports, runs, stats, tasks  # noqa: E402

app.include_router(tasks.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(exports.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
