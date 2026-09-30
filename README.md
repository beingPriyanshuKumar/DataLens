# DataLens: AI-Powered Autonomous Data Intelligence Platform

DataLens is an autonomous web intelligence system that converts ambiguous natural-language data requests into structured, verifiable, production-ready datasets. When given an open-ended goal—such as discovering recent AI funding rounds, scraping niche engineering roles, or tracking university research labs—DataLens dynamically designs target data schemas at runtime, generates multi-angle search queries, gathers public web pages under strict ethical crawling policies, extracts structured entities backed by mandatory verbatim source evidence, normalizes and deduplicates records, and streams live progress into an interactive dashboard.

---

## 🚀 Key Capabilities

- **Natural Language Schema Inference:** Dynamically generates field types, required constraints, and entity definitions from prompts using structured LLM outputs (Google Gemini or Anthropic Claude).
- **Multi-Angle Search Planning:** Deconstructs goals into orthogonal queries across providers (**Tavily Search API** or keyless **DuckDuckGo**).
- **Ethical Collection & SSRF Defense:** Enforces `robots.txt` compliance, 2-second per-domain politeness delays, blocks walled-garden domains (LinkedIn, Facebook, Twitter/X, Reddit), and strictly rejects private, loopback, link-local, and cloud metadata IPs (`169.254.169.254`, IPv6 `[::1]`, `[fe80::1]`) across all HTTP redirects.
- **Anti-Hallucination Evidence Verification:** Every extracted record requires verbatim text evidence matching the raw scraped page. Records with ungrounded claims are dropped automatically.
- **Data Normalization & Smart Deduplication:** Automatically normalizes dates, currencies, URLs, and emails. Deduplicates entities using exact key hashing and RapidFuzz token sorting with non-null field merging.
- **Explainable 3-Factor Confidence Scoring:** Computes a transparent confidence score ($0.0 - 1.0$) based on field completeness, cross-source corroboration, and schema cleanliness.
- **Reactive Dashboard & Streaming:** Real-time event log and funnel metrics streamed via Server-Sent Events (SSE) with automatic exponential backoff reconnection.
- **Multi-Format Exports:** Export verified datasets as chunk-streamed CSV, JSON with nested source provenance, or multi-sheet Excel workbooks (`.xlsx`).

---

## 🏛️ System Architecture

```
[ User Natural Language Prompt ]
               │
               ▼
┌──────────────────────────────────────────────┐
│ Phase 1: Dynamic Spec & Schema Parser (LLM)  │
│ - Entity definition, field types & constraints│
│ - Deduplication key fields selection         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Phase 2: Multi-Angle Query Planner (LLM)     │
│ - Generates diverse, high-coverage queries   │
│ - Visible execution steps displayed in UI    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Phase 3: Ethical Collection & Policy Gate    │
│ - Web search via Tavily API or DuckDuckGo    │
│ - robots.txt check & per-domain delay        │
│ - SSRF redirect inspection & IP validation   │
│ - Clean HTML text distillation (trafilatura) │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Phase 4: Entity Extraction & Proof Verifier  │
│ - Dynamic Pydantic schema validation         │
│ - Delimited untrusted page boundaries        │
│ - Mandatory verbatim evidence excerpting     │
│ - Substring & RapidFuzz ground-truth check   │
│ - Rejects and tracks hallucinated entries    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Phase 5: Normalization, Dedupe & Confidence  │
│ - ISO-8601 date, URL, email, casing cleaner  │
│ - Exact hash + RapidFuzz deduplication       │
│ - Multi-factor explainable confidence score  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Phase 6: Persistence & Real-Time Delivery    │
│ - SQLite WAL mode with foreign key cascades  │
│ - SSE stream with exponential backoff retry  │
│ - React UI (Vite, TypeScript, Design System) │
│ - Chunked CSV, JSON, and XLSX exports        │
└──────────────────────────────────────────────┘
```

---

## 🛠️ Quickstart & Setup

### Prerequisites
- **Python 3.11+** (Tested on Python 3.14)
- **Node.js 18+** & **npm**
- **LLM API Key:** Either Google Gemini (`GEMINI_API_KEY`) or Anthropic (`ANTHROPIC_API_KEY`)
- *(Optional)* **Tavily API Key:** Recommended for best search quality; falls back to keyless DuckDuckGo if omitted.

---

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Windows (cmd):
.\.venv\Scripts\activate.bat
# Linux/macOS:
source .venv/bin/activate

# Install dependencies in editable mode
pip install -e ".[dev]"
```

Configure `backend/.env` with your API keys:

```env
# ==========================================
# LLM Configuration (gemini or anthropic)
# ==========================================
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
SPEC_MODEL=gemini-3.5-flash-lite
EXTRACT_MODEL=gemini-3.5-flash-lite

# Or use Anthropic:
# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=your_anthropic_key_here
# SPEC_MODEL=claude-sonnet-4-20250514
# EXTRACT_MODEL=claude-sonnet-4-20250514

# ==========================================
# Search Provider (tavily or ddg)
# ==========================================
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=your_tavily_api_key_here

# ==========================================
# Database & Pipeline Controls
# ==========================================
DATABASE_URL=sqlite:///./datalens.db
MAX_PAGES_PER_RUN=8
FETCH_CONCURRENCY=5
PER_DOMAIN_DELAY_SECONDS=2.0
RUN_TIMEOUT_SECONDS=600

# Rate limits & concurrency pacing
LLM_MIN_INTERVAL_SECONDS=0.5
LLM_CONCURRENCY=2
API_RATE_LIMIT_PER_MINUTE=60
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

Run test suite:
```bash
pytest
```
*Expected: 55 passed in ~6.5 seconds.*

Start the FastAPI development server:
```bash
uvicorn app.main:app --reload --port 8000
```
- API Server: `http://localhost:8000`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`
- System Diagnostics: `http://localhost:8000/api/diagnostics`

---

### 2. Frontend Setup

```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```

- Dashboard Web App: `http://localhost:5173`

To build the optimized production bundle:
```bash
npm run build
```

---

## 🔒 Security & Code Quality Audit

DataLens was subjected to a comprehensive architecture, security, and concurrency audit documented in [audit_report.md](file:///e:/PROJECTS/codecubicle/audit_report.md). All 16 identified vulnerabilities have been remediated:

| Category | Highlights & Remediated Items |
|---|---|
| **Security & SSRF** | Manual 3-hop redirect inspection ensuring all redirect destinations re-verify against `is_allowed()`. Complete IPv4/IPv6 private IP filtering using DNS address info resolution. Strict prompt injection boundary tags (`<UNTRUSTED_PAGE_DATA>`). Spreadsheet formula injection protection against leading whitespace/tab evasion (`=`, `+`, `-`, `@`, `%`, `\t`). |
| **Data Integrity** | SQLite `PRAGMA foreign_keys = ON;` enforced on all connections. Declared SQLModel `Relationship(cascade="all, delete-orphan")` across all entities, fixing non-deterministic flush order and cascading task deletes. Safe fallback in deduplication logic when `key_fields` is empty to prevent dataset collapse. |
| **Performance & Scalability** | Eliminated N+1 query loops in records and exports with batch `IN (...)` queries. Fixed SQLite write lock contention with `busy_timeout = 30000`. Chunked streaming CSV export preventing unbounded in-memory string buffering. |
| **Streaming & UX** | Resilient SSE connection management in `useRunEvents` with exponential backoff reconnects and cursor preservation. Elimination of infinite server polling loops on missing runs. Global React `ErrorBoundary` and client-side table pagination. |
| **Code Cleanliness** | 100% compliant with `ruff check` and `ruff format`. Builtin `TimeoutError` exception handling and typing across all modules. |

---

## 💡 Example Natural Language Prompts

Try these prompts in the DataLens dashboard:

1. **Venture Capital & Startups:**
   > *"Find 20 AI and developer tools startups that raised Seed or Series A funding in 2025 or 2026, including their founders, round amount, and headquarters."*
2. **Talent & Hiring Intelligence:**
   > *"List 15 remote Staff and Principal AI Engineer job openings posted this month, including company, salary range, and primary tech stack."*
3. **Ecosystem & Hackathons:**
   > *"Find companies that sponsored developer hackathons in 2025 or 2026 with their developer relations links and sponsored prize categories."*
4. **Academic Research:**
   > *"Extract 10 recent research papers on speculative decoding and LLM inference optimization, including author names, institutions, and benchmark speedups."*

---

## 📊 Explainable Confidence Formula

Each extracted record is evaluated across three transparent factors:

$$\text{Confidence} = 0.5 \times \text{Completeness} + 0.3 \times \text{Corroboration} + 0.2 \times \text{Cleanliness}$$

- **Completeness ($50\%$):** Ratio of populated, non-null fields against the required schema specification.
- **Corroboration ($30\%$):** Boosts score when multiple independent web domains confirm the identical entity deduplication key.
- **Cleanliness ($20\%$):** Penalizes formatting anomalies, syntax errors, or schema type conversion warnings.

---

## 📂 Project Structure

```text
codecubicle/
├── audit_report.md           # In-depth architectural & security audit report
├── report.md                 # Project implementation & evaluation report
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI endpoints (tasks, runs, records, exports, stats, diagnostics)
│   │   ├── collectors/       # Search providers, httpx fetcher, and ethical policy gate
│   │   ├── core/             # Spec parser, planner, pipeline runner, LLM client, rate limiter
│   │   ├── processing/       # Trafilatura cleaner, extractor, normalizer, validator, deduper, verifier
│   │   ├── config.py         # Settings & environment variable configuration
│   │   ├── db.py             # Async SQLite engine, foreign keys listener, and migrations
│   │   ├── models.py         # SQLModel database tables & ORM relationships
│   │   └── schemas.py        # Pydantic data interchange models
│   └── tests/                # 55 unit and integration tests (pytest)
└── frontend/
    ├── src/
    │   ├── components/       # UI components (DataTable, ErrorBoundary, PlanEditor, Drawer, etc.)
    │   ├── hooks/            # useRunEvents hook with resilient exponential backoff
    │   ├── pages/            # Home dashboard and TaskDetail view
    │   ├── styles/           # Design system tokens and base styles
    │   └── types.ts          # TypeScript interfaces
    └── vite.config.ts        # Vite configuration & dev proxy
```

---

## 📜 License

Distributed under the MIT License. Built for Geek Room Problem Statement 01.
