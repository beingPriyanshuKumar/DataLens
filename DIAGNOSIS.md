# DIAGNOSIS.md — DataLens Pipeline Diagnosis

**Date:** 2026-09-30
**Diagnosed by:** Antigravity (automated)
**Prompt tested:** P1 — `Find remote machine learning engineer openings posted in the last 2 weeks.`

---

## Diagnosis Ladder

| Rung | Question | Status | Evidence | Notes |
|------|----------|--------|----------|-------|
| 1 | Both servers start with no errors? | **BROKEN** | Backend crashes with `extra_forbidden` for unknown env vars (`LLM_PROVIDER`, `GEMINI_API_KEY`, `SEARCH_PROVIDER`, `CORS_ORIGINS`, `RUN_TIMEOUT_SECONDS`) | `config.py` only defines 8 fields; `.env` now has 12. Pydantic `BaseSettings` rejects unknown fields. |
| 2 | Frontend reaches backend? | **BROKEN** | `const BASE = "http://localhost:8000/api"` hardcoded in `frontend/src/api/index.ts` | Works on port 8000, but breaks if backend is on another port. No dev proxy configured. |
| 3 | LLM configured and reachable? | **BROKEN** | `TypeError: "Could not resolve authentication method"` when calling Anthropic with empty key | `config.py` defaults to empty string `anthropic_api_key: str = ""`. No Gemini provider support. No `GET /api/diagnostics` endpoint exists. |
| 4 | Preview returns valid spec/plan? | **BROKEN** | `POST /api/tasks/preview` → HTTP 500 | Crashes at `spec.py:22` → `llm.py:64` because Anthropic SDK refuses empty API key. Error not caught gracefully. |
| 5 | Run leaves queued? | **UNVERIFIED** | Cannot test — preview fails first | Runner architecture looks correct (background task, own DB session). |
| 6 | Search returns URLs? | **BROKEN** | `search.py` only supports Tavily; no DDG fallback | With empty `TAVILY_API_KEY`, search would fail silently and return `[]`. |
| 7 | Policy allows anything? | OK | `policy.py` follows RFC 9309 correctly | Properly handles robots.txt with caching. |
| 8 | Fetches succeed? | OK | `fetcher.py` uses httpx + trafilatura | No chunking for long pages (brief §5.4 requires overlapping chunks). |
| 9 | Extraction returns candidates? | **BROKEN (partial)** | No page text chunking — long list pages truncated | Brief §5.4: pages over 8k chars lose most records. |
| 10 | Verification keeps them? | OK | `verifier.py` uses NFKC-like normalization + rapidfuzz ≥ 90 | Matches brief §5.5 requirements. |
| 11 | Validation keeps them? | OK | `validator.py` checks required fields | Spec rules (§5.6) about max required fields not enforced post-LLM. |
| 12 | Dedupe keeps them? | OK | `deduper.py` handles null keys with surrogate | Correctly implements §5.7. |
| 13 | Records persisted/queryable? | OK | `runner.py` uses deterministic IDs, WAL mode | Matches §7.2. |
| 14 | UI renders API data? | **BROKEN** | Demo/canned data on `?preview=demo` in Home.tsx lines 33-69 | Hardcoded fake preview data with "greenhouse.io" queries and fixed fields. |

---

## Root Cause List (ordered by impact)

### RC-1: No multi-provider LLM support [CRITICAL]
- **File:** `app/config.py` (lines 5, 11-12), `app/core/llm.py` (entire file)
- **Problem:** Only Anthropic SDK imported. No `LLM_PROVIDER` env var. No Gemini support. Hardcoded model IDs `claude-sonnet-4-20250514`.
- **Impact:** Product is unusable without an Anthropic key.

### RC-2: Config rejects new env vars [CRITICAL]
- **File:** `app/config.py`
- **Problem:** `BaseSettings` with only 8 fields. Adding `LLM_PROVIDER`, `GEMINI_API_KEY`, `SEARCH_PROVIDER`, `CORS_ORIGINS`, `RUN_TIMEOUT_SECONDS` to `.env` causes startup crash (`extra_forbidden`).
- **Impact:** Backend won't start with the new `.env`.

### RC-3: No search fallback [HIGH]
- **File:** `app/collectors/search.py`
- **Problem:** Only Tavily supported. No DuckDuckGo (`ddgs`) fallback. With empty key, returns `[]` silently.
- **Impact:** No search results → no pages → no records → empty output.

### RC-4: No diagnostics endpoint [HIGH]
- **File:** (missing)
- **Problem:** No `GET /api/diagnostics` to check LLM, search, and DB health.
- **Impact:** User has no way to know what's misconfigured.

### RC-5: Hardcoded localhost in frontend [MEDIUM]
- **File:** `frontend/src/api/index.ts` (line 14)
- **Problem:** `const BASE = "http://localhost:8000/api"` — breaks in production.
- **Impact:** Frontend can't reach backend in any non-dev environment.

### RC-6: Hardcoded CORS origins [MEDIUM]
- **File:** `app/main.py` (line 23)
- **Problem:** `allow_origins=["http://localhost:5173", "http://localhost:5174"]` — hardcoded ports.
- **Impact:** CORS fails if frontend runs on a different port.

### RC-7: Canned demo data in Home.tsx [MEDIUM]
- **File:** `frontend/src/pages/Home.tsx` (lines 33-69)
- **Problem:** `?preview=demo` URL param returns hardcoded fake preview with fixed fields/queries.
- **Impact:** Violates brief §2.3 — "no canned/fake data in production paths."

### RC-8: No page text chunking [LOW]
- **File:** `app/processing/extractor.py`
- **Problem:** Entire page text sent to LLM in one call. Pages >12k chars get truncated by LLM context window.
- **Impact:** List/directory pages lose most records.

### RC-9: Spec required fields not clamped [LOW]
- **File:** `app/core/spec.py`
- **Problem:** LLM can mark all fields as `required=true`, causing 100% validation rejection.
- **Impact:** Brief §5.6 — at most key_fields (max 3) should be required.

---

## Proposed Fix Order

1. **Fix config.py** — Add all env vars, remove hardcoded model IDs
2. **Fix llm.py** — Add Gemini provider, schema simplification, timeout
3. **Fix search.py** — Add DuckDuckGo fallback
4. **Add diagnostics endpoint** — `GET /api/diagnostics`
5. **Fix main.py** — CORS from config
6. **Fix frontend API** — Vite dev proxy, relative paths
7. **Remove canned demo data** — Home.tsx
8. **Add page chunking** — extractor.py
9. **Enforce spec rules** — spec.py post-processing
10. **Install missing deps** — `google-genai`, `duckduckgo-search`
