# DataLens: AI-Powered Autonomous Data Intelligence Platform

DataLens is an autonomous web intelligence system that converts ambiguous natural-language data requests into structured, verifiable, production-ready datasets. When given an open-ended goal—such as discovering recent AI funding rounds, scraping niche engineering roles, or tracking university research labs—DataLens dynamically designs target data schemas at runtime, generates multi-angle search queries, gathers public web pages under strict ethical crawling policies, extracts structured entities backed by mandatory verbatim source evidence, normalizes and deduplicates records, and streams live progress into an interactive dashboard.

---

## 🚀 Key Capabilities

- **Natural Language Schema Inference & Required Fields Cap:** Dynamically generates field types, required constraints, and entity definitions from prompts using structured LLM outputs (Google Gemini or Anthropic Claude). Caps required fields to primary identifiers (max 2–3) so unstated secondary attributes (e.g. stipend amounts or contact emails) never cause valid records to be discarded.
- **Multi-Angle Search Planning with Domain Preservation:** Deconstructs goals into orthogonal queries across providers (**Tavily Search API** or keyless **DuckDuckGo**), preserving critical domain qualifiers (`AI`, `Fintech`, specific technologies) while avoiding walled gardens and generic job board login walls.
- **Ethical Collection & SSRF Defense:** Enforces `robots.txt` compliance, 2-second per-domain politeness delays, blocks walled-garden and video platforms (LinkedIn, Facebook, Instagram, Twitter/X, Reddit, YouTube), and strictly rejects private, loopback, link-local, and cloud metadata IPs (`169.254.169.254`, IPv6 `[::1]`, `[fe80::1]`) across all HTTP redirects.
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
*Expected: 69 passed in ~7 seconds.*

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

Run frontend unit tests:
```bash
npx vitest run
```
*Expected: 16 passed.*

To build the optimized production bundle:
```bash
npm run build
```

---

## 🧭 Five-Tab Editorial User Interface

The DataLens frontend is designed around a clean, light editorial grid (`#B9C4C1` backdrop, crisp ink hairlines, Space Grotesk / Inter / IBM Plex Mono typography) organized into five dedicated tabs:

1. **HOME (`/`):** Core value proposition, live platform counters from `/api/stats`, clickable starter prompt cards, and quick workflow explanation.
2. **COLLECT (`/collect`, `/collect/:taskId`):** The primary 4-stage stepper:
   - **01 Describe:** Natural language prompt textarea and **Search Region** selector (`Worldwide`, `India`, `United States`, `United Kingdom`, `Canada`, `Australia`, `Singapore`, `UAE`, `Germany`, `France`, etc.).
   - **02 Review Plan:** Editable schema field definitions, generated queries, filters, and target limits.
   - **03 Run & Monitor:** Live stage checklist, funnel analytics (`Raw -> Verified -> Valid -> Deduped`), progress indicators, real-time event logs, and early row preview.
   - **04 Results & Export:** Interactive data grid, full evidence inspection drawer, Sources audit tab, execution run history, and trust metrics.
3. **TASKS (`/tasks`):** Historical task log with real-time status filtering (`RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`), prompt search, lazy-loaded run history, re-run execution, and per-task data deletion with foreign-key cascade.
4. **GUIDE (`/guide`):** Step-by-step usage guide, prompt engineering cookbook, region selection mechanics, and troubleshooting FAQ.
5. **TRUST (`/trust`):** Complete crawling policy disclosure (robots.txt, domain restrictions, rate pacing), verbatim quote verification mechanics, live system diagnostics (backend, database, search status), and honest platform limitations.

---

## Optional Runtime Configuration & Parameters

DataLens can be customized via standard process environment variables without modifying source code:

| Setting | Default | Description |
|---|:---:|---|
| `MAX_CONCURRENT_RUNS` | `2` | Global concurrency semaphore for active pipeline tasks. Additional runs queue gracefully until a slot is available. |
| `TRUSTED_PROXIES` | `""` | Comma-separated list of reverse proxy IP addresses. Only requests originating from these hosts have their `X-Forwarded-For` header parsed for rate limiting. |
| `MAX_PAGES_PER_RUN` | `8` | Maximum web pages crawled per pipeline run (can be overridden per-command, e.g. `MAX_PAGES_PER_RUN=30`). |
| `DATABASE_URL` | `sqlite:///./datalens.db` | SQLAlchemy database connection string (SQLite WAL mode by default). |
| `API_RATE_LIMIT_PER_MINUTE` | `60` | IP-based request throttling rate limit on API endpoints. |

---

## 🛡️ Deployment & Security Headers Note

The DataLens backend middleware injects standard security headers on all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (on API JSON responses)

**Reverse Proxy Note:** When hosting the frontend client in a production cloud environment behind an HTTPS reverse proxy (e.g. Nginx, Caddy, or Cloudflare), enable HTTP Strict Transport Security (HSTS):
```text
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 💡 Example Natural Language Prompts

Try these benchmark prompts in the DataLens dashboard:

1. **AI Startups Hiring Student Interns:**
   > *"Find 50 AI startups that are open to hire students with zero experience with paid internship"*
2. **European Cybersecurity Startups:**
   > *"Find 10 cybersecurity startups in Europe with their headquarters city and core security product"*
3. **Machine Learning Jobs:**
   > *"Find 15 remote machine learning engineer jobs with salary ranges, companies, and requirements"*
4. **Indian SaaS Startup Seed Funding:**
   > *"Find 10 Indian SaaS startups that raised seed funding in 2025 with investor names and round size"*
5. **Developer Hackathon Sponsors:**
   > *"Find companies that sponsored developer hackathons in 2025 or 2026 with their developer relations links and sponsored prize categories"*

---

## ⚠️ Known Limitations

- **JavaScript-Rendered Single-Page Apps:** Static HTTP fetching targets pre-rendered HTML. When sites render entirely client-side via JavaScript without SSR, DataLens falls back to search provider text snippets for policy-compliant URLs.
- **Search Provider Index Dependency:** Web coverage depends on what public search engines have indexed.
- **Region Bias vs Hard Geofencing:** Selecting a search region (e.g. India or Germany) injects localized terms and country parameters into search queries, but does not guarantee every returned global source originates strictly from that boundary.
- **Local Single-Operator Context:** The local demo build is unauthenticated for rapid hackathon judging. Public internet deployments require adding an access gateway or API authentication middleware (noted under audit finding `VULN-002`).

---

## 📂 Project Structure

```text
codecubicle/
├── LICENSE                   # Open source MIT license
├── README.md                 # Setup, architecture, and usage documentation
├── docs/
│   ├── AUDIT_REPORT.md       # Comprehensive codebase security & concurrency audit
│   ├── COMPLIANCE_REPORT.md  # Problem statement compliance and verification report
│   ├── CHANGE_REPORT.md      # Summary of audit fixes, yield enhancements, and verification
│   └── screenshots/          # Curated full-page 1440px and responsive screenshots
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI endpoints (tasks, runs, records, exports, regions, policy)
│   │   ├── collectors/       # Search providers, streaming httpx fetcher, and SSRF policy gate
│   │   ├── core/             # Spec parser, planner, pipeline runner, rate limiter, semaphore
│   │   ├── processing/       # Trafilatura cleaner, extractor, normalizer, verifier, deduper
│   │   ├── config.py         # Settings & environment variable configuration
│   │   ├── db.py             # SQLite WAL engine with foreign key enforcement
│   │   ├── models.py         # SQLModel database tables & cascading relationships
│   │   ├── regions.py        # Supported search regions registry
│   │   └── schemas.py        # Pydantic data interchange models & filter coercion
│   └── tests/                # 69 unit and integration tests (pytest)
└── frontend/
    ├── src/
    │   ├── components/       # Editorial UI components (DataTable, Drawer, PlanEditor, etc.)
    │   ├── content/          # Guide and documentation content
    │   ├── hooks/            # useRunEvents hook with resilient backoff
    │   ├── pages/            # 5 Tab Pages: Home, Collect, Tasks, Guide, Trust
    │   ├── styles/           # Design system tokens, layout, and reset styles
    │   ├── types/            # TypeScript schemas and models
    │   └── utils/            # URL safety helpers (safeHref) and unit tests
    └── vite.config.ts        # Vite configuration & dev proxy
```

---

## 📜 License

Distributed under the MIT License. Copyright (c) 2026 Team CodeCubicle. Built for Problem Statement 01.
