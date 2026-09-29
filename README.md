# DataLens: AI-Powered Data Intelligence Platform

DataLens is an autonomous web intelligence system that turns natural-language data requests into structured, verified datasets. When given an open-ended goal (such as finding recent startup fundings, niche job openings, or hackathon sponsors), DataLens dynamically infers the target schema, plans multi-angle search queries, gathers public pages under ethical scraping policies, extracts structured records with verbatim source evidence, normalizes and deduplicates entries, and streams progress live into an interactive verification dashboard.

---

## Architecture Flow

```
User prompt
   │
   ▼
[1] Spec Parser (LLM) ───────► TaskSpec (entity, fields, filters, key_fields, target_count)
   │
   ▼
[2] Planner (LLM) ───────────► Plan (ordered steps + search queries), shown in UI
   │
   ▼
[3] Runner (async worker)
   │   ├─ Search        → candidate URLs (Tavily search API)
   │   ├─ Policy filter → drop blocked/disallowed URLs (robots.txt & SSRF guard)
   │   ├─ Fetch         → HTML (rate-limited, concurrent via httpx)
   │   ├─ Clean         → main text (trafilatura)
   │   ├─ Extract (LLM) → candidate records + verbatim evidence snippets
   │   ├─ Verify        → drop records whose evidence is not in page text
   │   ├─ Normalize     → dates, URLs, casing, whitespace
   │   ├─ Validate      → required fields, types, URL/email format
   │   ├─ Dedupe        → exact key hash + fuzzy matching (rapidfuzz)
   │   ├─ Score         → confidence score per record (completeness + corroboration + cleanliness)
   │   └─ Persist       → SQLite database & event log
   │
   ▼
[4] SQLite Database (tasks, runs, run_events, sources, records, record_evidence)
   │
   ▼
[5] REST + SSE API (FastAPI) ──► React Dashboard (TypeScript, Vite, Vanilla CSS)
```

---

## Setup & Running

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Anthropic API key
- Tavily Search API key

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -e ".[dev]"
```

Create a `.env` file in `backend/.env` with your API keys:

```env
ANTHROPIC_API_KEY=your-anthropic-key-here
TAVILY_API_KEY=your-tavily-key-here
DATABASE_URL=sqlite:///./datalens.db
MAX_PAGES_PER_RUN=50
FETCH_CONCURRENCY=5
PER_DOMAIN_DELAY_SECONDS=2.0
SPEC_MODEL=claude-sonnet-4-20250514
EXTRACT_MODEL=claude-sonnet-4-20250514
```

Run tests to verify everything is working:
```bash
pytest
```

Start the FastAPI backend server:
```bash
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://localhost:8000` (docs at `http://localhost:8000/docs`).

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend dashboard will be running at `http://localhost:5173`.

---

## Example Prompts

1. **Job Market Intelligence:**
   > "Find remote machine learning engineer openings posted in the last 2 weeks."
2. **Startup & Investment Research:**
   > "List 30 Indian SaaS startups that raised seed funding in 2025 with their founders."
3. **Sponsorship & Partnerships:**
   > "Find companies that sponsored hackathons in India in the last two years."

---

## Key Design Decisions

1. **Evidence-First Verification (Anti-Hallucination Guarantee):**
   Every extracted record must include a verbatim text snippet (`evidence`) extracted directly from the source page. The verifier validates that this excerpt exists in the raw page text (using exact substring and high-threshold fuzzy matching). Any record whose evidence cannot be grounded in the source page is dropped and tracked as a hallucination count.
2. **Dynamic Schema & Dynamic Pydantic Models:**
   There are no hardcoded site scrapers. The LLM infers the entity structure and field definitions (`FieldSpec`) from the user's prompt. During extraction, a dynamic Pydantic schema is created at runtime, enforcing type safety and required constraints for arbitrary domains.
3. **Code-Enforced Ethical Source Policy:**
   All web access is gated through a single policy filter (`policy.py`). The policy respects `robots.txt` directives, enforces a 2-second per-domain politeness delay, guards against Server-Side Request Forgery (SSRF) by blocking private, loopback, and link-local IP addresses, and permanently blocks walled-garden social networks (LinkedIn, Facebook, Instagram, Twitter/X, Reddit).
4. **Explainable Confidence Scoring:**
   Each record receives a composite confidence score in $[0, 1]$ computed from three transparent factors:
   $$\text{Confidence} = 0.5 \times \text{Completeness} + 0.3 \times \text{Corroboration} + 0.2 \times \text{Cleanliness}$$
   where completeness reflects non-null fields, corroboration measures distinct cross-verifying sources, and cleanliness penalizes formatting or validation flags.

---

## Known Limitations

- **JavaScript-Rendered Pages:** Extraction currently relies on HTTP retrieval and `trafilatura` for page cleaning. Heavy single-page apps (SPAs) that require client-side JavaScript execution to render content may yield empty text unless pre-rendered or handled by a headless browser fallback.
- **Search Provider Dependency:** Search candidate discovery is dependent on Tavily API queries and index freshness.
- **LLM Rate Limits and Token Budgets:** Runs fetching dozens of lengthy articles consume API tokens for extraction; large target counts are capped at `MAX_PAGES_PER_RUN` (default 50) to prevent unexpected API costs.
