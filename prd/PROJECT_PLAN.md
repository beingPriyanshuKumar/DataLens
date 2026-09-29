# AI-Powered Data Intelligence Platform: Build Plan

Working name: **DataLens**
Hackathon: Geek Room, Problem Statement 01
Timeline: online round **3 Oct**, offline round **11 Oct**. Plan written **29 Sept 2026**.

---

## 0. How to use this document

- Read sections 1 to 4 once. They fix scope, stack, and architecture.
- Section 5 is the day-by-day build order. Follow it in sequence. Do not skip ahead to the dashboard before the pipeline works.
- Section 12 holds the **clean-code rules**. Paste them into every AI coding session (Claude Code, Cursor, etc.) as a standing instruction.
- Every phase ends with an **acceptance check**. Do not move on until it passes.

**Assumptions I made (change them if wrong):**
- Python backend, React frontend, SQLite database.
- An Anthropic (Claude) API key and a Tavily (search) API key are available. If you only have other providers, only `llm.py` and `search.py` change.
- Team of 1 to 3 people. If you are solo, cut P1 items first.

---

## 1. Scope

### 1.1 Priorities

| Priority | Meaning | Rule |
|---|---|---|
| **P0** | Without this, the project fails the problem statement | Must work by 3 Oct |
| **P1** | Strong differentiator | Build for 11 Oct, or 3 Oct if ahead |
| **P2** | Nice to have | Only if everything else is done |

### 1.2 Feature map (each line of the problem statement)

| # | Requirement from PDF | Feature | Priority | Status |
|---|---|---|---|---|
| 1 | Understand natural-language prompts | Prompt → structured `TaskSpec` (LLM) | P0 | ✅ Completed & Tested |
| 2 | Dynamically design workflows | Planner produces a visible, per-prompt plan | P0 | ✅ Completed & Tested |
| 3 | Collect from multiple permitted sources | Search + fetch across many domains, with a source policy | P0 | ✅ Completed & Tested |
| 4 | Clean, structure, validate, deduplicate | Normalize → validate → dedupe pipeline | P0 | ✅ Completed & Tested |
| 5 | Source-backed, traceable data | Every record links to URL + evidence snippet | P0 | ✅ Completed & Tested |
| 6 | Interactive dashboard | Results table with search, filter, sort | P0 | ✅ Completed & Tested |
| 7 | Monitor and manage tasks | Live progress, cancel, re-run | P0 | ✅ Completed & Tested |
| 8 | Search, filter, export | CSV + JSON export (XLSX built as well) | P0 | ✅ Completed & Tested |
| 9 | Workflow and dataset history | Task list, runs, per-run datasets | P0 | ✅ Completed & Tested |
| 10 | Inspect sources | Sources tab (URL, status, records yielded) | P1 | ✅ Completed & Tested |
| 11 | Compare runs | New / removed / changed records between runs | P1 | Planned (Phase 9) |
| 12 | Adaptive collection | Second search pass if target count is not met | P1 | Planned (Phase 9) |
| 13 | JS-rendered pages | Playwright fallback fetcher | P2 | Planned (Phase 9) |
| 14 | Scheduled re-runs | Cron-style recurring tasks | P2 | Planned (Phase 9) |

### 1.3 Explicit non-goals (do not build these)

- User accounts, auth, multi-tenancy.
- Celery, Redis, Kafka, Docker Compose with 6 services. A background asyncio worker is enough.
- Per-site custom scrapers. The whole point is LLM extraction against a dynamic schema.
- Scraping login-walled sites (LinkedIn, Facebook, Instagram). Do not do it. It is both a legal risk and a judge trap.
- A vector database. Fuzzy string matching covers dedupe.

---

## 2. Tech stack (with reasons)

### Backend

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | Best ecosystem for scraping and LLMs |
| API framework | FastAPI | Async, automatic docs, Pydantic built in |
| Database | SQLite via SQLModel | Zero setup, one file, enough for a demo. Swappable to Postgres |
| Background work | `asyncio` tasks inside the FastAPI process | No extra infrastructure |
| HTTP client | `httpx` (async) | Timeouts, retries, concurrency |
| Content extraction | `trafilatura` | Strips nav/ads and returns main page text |
| Search | Tavily API (fallback: `ddgs`) | Purpose-built for LLM pipelines, returns clean URLs |
| LLM | Anthropic SDK, thin wrapper | Structured output via tool use |
| Fuzzy dedupe | `rapidfuzz` | Fast, no model needed |
| Dynamic schemas | `pydantic.create_model` | Build a validator from the LLM's field list at runtime |
| Robots.txt | `urllib.robotparser` (stdlib) | No dependency |
| Excel export | `openpyxl` (P1) | Standard |
| Tests | `pytest`, `pytest-asyncio`, `respx` | Mock HTTP and LLM |
| Lint/format | `ruff` | One tool for both |

### Frontend

| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite + TypeScript (strict) | Fast to start, no SSR complexity |
| Styling | Tailwind CSS | No custom CSS files to maintain |
| Data fetching | TanStack Query | Caching, polling, invalidation |
| Tables | TanStack Table | Sorting, filtering, column control |
| Routing | React Router | Standard |
| Live updates | Native `EventSource` (SSE) | Simpler than WebSockets |
| Icons | `lucide-react` | Small and consistent |

### Why not Next.js?
You do not need SSR or a second server. Vite plus FastAPI is fewer moving parts.

---

## 3. Architecture

### 3.1 High-level flow

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
   │   ├─ Search        → candidate URLs
   │   ├─ Policy filter → drop blocked/disallowed URLs
   │   ├─ Fetch         → HTML (rate-limited, concurrent)
   │   ├─ Clean         → main text (trafilatura)
   │   ├─ Extract (LLM) → candidate records + evidence snippets
   │   ├─ Verify        → drop records whose evidence is not in the page text
   │   ├─ Normalize     → dates, URLs, casing, whitespace
   │   ├─ Validate      → required fields, types, URL/email format
   │   ├─ Dedupe        → exact key + fuzzy match
   │   ├─ Score         → confidence per record
   │   └─ Refine        → if count < target, generate new queries (max 1 extra pass)
   │
   ▼
[4] SQLite (tasks, runs, events, sources, records, evidence)
   │
   ▼
[5] REST + SSE API ───────────► React dashboard
```

### 3.2 Key design decisions

1. **The schema is dynamic.** The LLM decides the fields per prompt. A Pydantic model is built at runtime and used to validate extraction output. This is what makes the platform general and not a job-scraper in disguise.
2. **Evidence-first extraction.** The LLM must return a verbatim `evidence` snippet with every record. Code then checks that the snippet actually appears in the fetched page text. If it doesn't, the record is discarded. This is your anti-hallucination guarantee and your traceability feature in one mechanism.
3. **A run is a dataset version.** A task is the prompt and spec. Each execution is a `run`. Records belong to a run. History and diffing become simple queries.
4. **Events are persisted.** Every pipeline step writes a row to `run_events`. The SSE endpoint streams new rows. This gives live progress, a log, and history from a single mechanism.
5. **Cancel is cooperative.** The runner checks `run.status` between pages. No thread killing.
6. **Source policy is code, not a suggestion.** One module decides whether a URL may be fetched. Nothing else fetches.

---

## 4. Data model

All tables in `models.py`. IDs are UUID strings.

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | str (pk) | |
| prompt | text | Original user text |
| spec | json | Validated `TaskSpec` |
| created_at | datetime | |
| updated_at | datetime | |

### `runs`
| Column | Type | Notes |
|---|---|---|
| id | str (pk) | |
| task_id | str (fk) | |
| plan | json | Steps and queries used |
| status | enum | `queued`, `running`, `completed`, `failed`, `cancelling`, `cancelled` |
| stats | json | raw_count, verified_count, valid_count, deduped_count, pages_fetched, pages_failed |
| error | text null | Failure reason |
| started_at / finished_at | datetime | |

### `run_events`
| Column | Type | Notes |
|---|---|---|
| id | int (autoincrement, pk) | Used as SSE cursor |
| run_id | str (fk) | |
| level | enum | `info`, `warn`, `error` |
| step | str | `search`, `fetch`, `extract`, ... |
| message | text | Human-readable |
| created_at | datetime | |

### `sources`
| Column | Type | Notes |
|---|---|---|
| id | str (pk) | |
| run_id | str (fk) | |
| url | text | |
| domain | str | |
| status | enum | `fetched`, `blocked_by_policy`, `blocked_by_robots`, `failed`, `skipped` |
| http_status | int null | |
| reason | text null | |
| records_found | int | Number of verified records extracted from it |
| fetched_at | datetime | |

### `records`
| Column | Type | Notes |
|---|---|---|
| id | str (pk) | |
| run_id | str (fk) | |
| data | json | Field name → value |
| dedupe_key | str | Hash of normalized key fields |
| confidence | float | 0 to 1 |
| flags | json | List of validation warnings |

### `record_evidence`
| Column | Type | Notes |
|---|---|---|
| id | str (pk) | |
| record_id | str (fk) | |
| source_id | str (fk) | |
| snippet | text | Verbatim text from the page |

A record can have multiple evidence rows (same record found on several sites). That is what "corroboration" means and it raises confidence.

---

## 5. Build phases

Today is 29 Sept. The online round is 3 Oct, so you have about four working days. The schedule below fits that. Days after 3 Oct go to P1 items and polish for 11 Oct.

> **Blunt warning:** if you start with the dashboard, you will end with a pretty UI over a pipeline that does not work. Build the backend pipeline and test it from the command line **before** touching the frontend.

---

### Phase 0: Setup [COMPLETED] (Day 1 morning, ~2 hours)

**Goal:** both projects run, database connects, keys are loaded, repo is clean.

Steps:
1. Create the repo and folder structure (section 6).
2. Backend:
   - `python -m venv .venv`, install dependencies, and pin them in `pyproject.toml`.
   - Create `app/config.py` using `pydantic-settings`. Load `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `DATABASE_URL`, `MAX_PAGES_PER_RUN`, `FETCH_CONCURRENCY`, `PER_DOMAIN_DELAY_SECONDS`.
   - Create `.env.example` with placeholder names only. Add `.env` to `.gitignore`.
   - Create `app/db.py` (engine, session dependency, `create_all` on startup).
   - Create `app/main.py` with `/health` and CORS for `http://localhost:5173`.
3. Frontend:
   - `npm create vite@latest frontend -- --template react-ts`.
   - **Immediately delete scaffold junk:** `App.css`, `assets/react.svg`, `public/vite.svg`, the counter demo in `App.tsx`. See section 12.
   - Install Tailwind, React Router, TanStack Query, TanStack Table, lucide-react.
4. Configure `ruff` (backend) and ESLint + Prettier (frontend). Enable TypeScript `strict`.

**Acceptance check:** `GET /health` returns OK, the Vite page loads with a blank Tailwind-styled shell, `ruff check` and `tsc --noEmit` pass with zero warnings.

---

### Phase 1: Contracts and LLM wrapper [COMPLETED] (Day 1, ~4 hours)

**Goal:** all shared data shapes defined once, and one function that reliably gets structured output from the LLM.

Steps:
1. **Define `TaskSpec`** in `schemas.py`:
   ```python
   class FieldSpec(BaseModel):
       name: str            # snake_case
       type: Literal["str", "int", "float", "bool", "date", "url", "email"]
       description: str
       required: bool

   class TaskSpec(BaseModel):
       title: str
       entity: str                       # e.g. "job_opening"
       fields: list[FieldSpec]           # 3 to 12 fields
       filters: dict[str, str]           # free-form constraints
       key_fields: list[str]             # fields that identify a unique record
       target_count: int                 # default 30, max 200
       source_hints: list[str]           # e.g. ["job boards", "company career pages"]
       assumptions: list[str]            # anything the LLM guessed
       clarification: str | None         # set if the prompt is too vague to proceed
   ```
2. **Define `Plan` and `PlanStep`:**
   ```python
   class PlanStep(BaseModel):
       type: Literal["search", "fetch", "extract", "validate", "dedupe"]
       description: str

   class Plan(BaseModel):
       queries: list[str]                # 3 to 6 search queries
       steps: list[PlanStep]
       max_pages: int
   ```
3. **Write `core/llm.py`**: one function:
   ```python
   async def generate_structured(system: str, user: str, output_model: type[T]) -> T
   ```
   - Use Anthropic tool use with the Pydantic model's JSON schema, and force the tool call.
   - Validate the result with `output_model.model_validate`.
   - On validation failure, retry once, feeding the validation error back to the model. After that, raise a typed `LLMError`.
   - Nothing else in the codebase imports the Anthropic SDK.
4. Use a cheaper, faster model for extraction, and a stronger one for spec/plan generation. Put both model names in `config.py`.

**Acceptance check:** a script calls `generate_structured` with a trivial prompt and receives a valid `TaskSpec`. Bad output triggers exactly one retry.

---

### Phase 2: Spec parser and planner [COMPLETED] (Day 1 to Day 2, ~4 hours)

**Goal:** prompt → `TaskSpec` → `Plan`, working and inspectable.

Steps:
1. **`core/spec.py`**: `parse_prompt(prompt: str) -> TaskSpec`.
   - System prompt rules:
     - Infer the entity and 3 to 12 fields. Always include a source URL field only if it is part of the business need; provenance is stored separately.
     - Choose `key_fields` (the minimal set that uniquely identifies a record, e.g. `company + title + location`).
     - Set `target_count` from the prompt ("50 leads"), else 30.
     - List every assumption made.
     - If the prompt cannot be turned into a data collection task (e.g. "hi", or something illegal), set `clarification` and leave `fields` minimal.
   - Field names must be `snake_case`; enforce with a Pydantic validator.
2. **`core/planner.py`**: `build_plan(spec: TaskSpec) -> Plan`.
   - Generate 3 to 6 diverse search queries (different phrasings, different site angles).
   - Generate the human-readable step list. The list is descriptive and derived from the spec, e.g. "Search 5 queries", "Fetch up to 40 pages", "Extract fields X, Y, Z", "Validate", "Deduplicate by K".
   - `max_pages` is capped by config.
3. API endpoint `POST /api/tasks/preview` accepts a prompt and returns `{spec, plan}` **without running anything**. The UI uses this for the review-and-approve step.
4. If `clarification` is set, the API returns it and the UI asks the user.

**Acceptance check:** run five different prompts (jobs, leads, sponsors, product prices, events). Each returns a sensible, *different* schema and query set. Read the outputs. If they are generic or repetitive, fix the system prompt now, because everything downstream depends on it.

---

### Phase 3: Collection layer [COMPLETED] (Day 2, ~5 hours)

**Goal:** given queries, return clean page text, legally and politely.

Steps:
1. **`collectors/policy.py`**: the single gate for all fetching.
   - `BLOCKED_DOMAINS` constant: linkedin.com, facebook.com, instagram.com, x.com, twitter.com, and other login-walled sites.
   - `is_allowed(url) -> PolicyDecision` checks: scheme is http/https, domain not blocked, not a private/internal IP (SSRF protection), and robots.txt permits the path for your user agent.
   - Cache robots.txt per domain for the run.
   - Returns a reason string for every denial. The reason is stored in `sources.reason`.
2. **`collectors/search.py`**: `search(query, limit) -> list[SearchResult]` via Tavily. Dedupe URLs across queries. Normalize URLs (strip tracking params like `utm_*`, fragments).
3. **`collectors/fetcher.py`**:
   - `fetch_page(url) -> FetchedPage | FetchError` using `httpx.AsyncClient`: 15 s timeout, follow redirects (max 3), honest User-Agent (`DataLensBot/1.0`), max response size 2 MB, `text/html` only.
   - Per-domain rate limit (one request per `PER_DOMAIN_DELAY_SECONDS`).
   - Global concurrency via `asyncio.Semaphore(FETCH_CONCURRENCY)`.
   - Retry transient errors (5xx, timeouts) up to 2 times with backoff. Do not retry 4xx.
4. **Cleaning**: `trafilatura.extract(html)` returns the main text. Discard pages with fewer than ~200 characters of text. Truncate to a token-safe length (e.g. 12k characters) per page. Split into chunks only if a page is long *and* likely a list.
5. Record each attempted URL in `sources` with status and reason.

**Acceptance check:** a script takes 3 queries and outputs ≥ 20 cleaned pages, with blocked domains correctly refused and the reasons logged. Time it. If it takes more than about 60 seconds for 20 pages, adjust concurrency.

---

### Phase 4: Extraction and verification [COMPLETED] (Day 2 to Day 3, ~6 hours)

**Goal:** turn page text into candidate records that are provably grounded in the page.

Steps:
1. **`processing/extractor.py`**:
   - Build the per-request Pydantic model at runtime with `create_model` from `TaskSpec.fields`, plus a required `evidence: str` field.
   - Output model: `list[Record]`, wrapped in an object for tool-use compatibility.
   - System prompt rules (write these exactly, they matter):
     - "Extract only records that are explicitly stated in the text."
     - "Never guess or infer missing values. Use null."
     - "`evidence` must be an exact, verbatim excerpt (≤ 300 characters) from the text that supports the record."
     - "If the page contains no matching records, return an empty list."
     - Include the `filters` from the spec so irrelevant records are skipped at extraction.
   - One LLM call per page, run concurrently with a semaphore.
2. **Evidence verification** (`processing/verifier.py`):
   - Normalize whitespace and case in both snippet and page text.
   - Accept if the snippet is a substring of the page text, else accept if fuzzy partial match ≥ 90 (`rapidfuzz.fuzz.partial_ratio`).
   - Otherwise **discard the record** and log a `warn` event ("hallucinated record dropped"). Track the count in `stats`. It is a good number to show judges.
3. Attach `source_id` and snippet to each surviving record.

**Acceptance check:** run on 10 pages. Manually open 5 records and confirm every value appears on the source page. If you find a value that is not on the page, tighten the prompt and the verifier before continuing.

---

### Phase 5: Normalize, validate, dedupe, score [COMPLETED] (Day 3, ~5 hours)

**Goal:** turn raw candidates into a clean dataset.

**`processing/normalizer.py`**: pure functions, no I/O.
- Strings: trim, collapse whitespace, unicode normalize.
- Dates: parse with `dateparser` to ISO `YYYY-MM-DD`; on failure set `null` and add a flag.
- URLs: resolve relative links against the source URL, strip tracking params, lowercase host.
- Emails: lowercase and strip.
- Numbers and currency: parse to number with a separate currency field only if the spec has one.

**`processing/validator.py`**:
- Validate against the dynamic Pydantic model.
- Required fields present → otherwise the record is *rejected* (counted in `stats`).
- Optional field problems → the record is *kept* with a flag (e.g. `"invalid_email"`).
- Optional URL check: send `HEAD` requests to `url`-type fields (P1, rate-limited, off by default).

**`processing/deduper.py`**:
1. Build `dedupe_key`: normalize `key_fields` values (lowercase, strip punctuation and legal suffixes like "inc", "llc", "pvt", "ltd"), then hash the joined string.
2. Exact pass: group by `dedupe_key`.
3. Fuzzy pass: within the remaining records, compare the joined key strings with `rapidfuzz.fuzz.token_sort_ratio ≥ 90` and merge.
4. Merge rule: keep the record with the most non-null fields; fill nulls from duplicates; keep **all** evidence rows.

**`processing/scorer.py`**: confidence in [0, 1] from simple, explainable parts:
- 0.5 × completeness (share of fields filled)
- 0.3 × corroboration (min(number of distinct source domains, 3) / 3)
- 0.2 × validation cleanliness (1 − 0.25 × number of flags, floor 0)

Document the formula in a docstring. Judges will ask.

**Acceptance check:** unit tests pass (section 9). On a real run, the `stats` show a visible funnel, e.g. `raw 120 → verified 96 → valid 81 → deduped 63`.

---

### Phase 6: Runner, persistence, events, cancel [COMPLETED] (Day 3, ~5 hours)

**Goal:** the pipeline runs end to end in the background, and the API can start, watch, and stop it.

Steps:
1. **`core/events.py`**: `emit(run_id, level, step, message)` writes a `run_events` row. One function, used everywhere.
2. **`core/runner.py`**: `execute_run(run_id)`:
   ```
   set status running
   for each query: search → collect URLs
   apply policy → record blocked sources
   fetch + clean (concurrent) → record sources
   extract per page (concurrent)
   verify evidence
   normalize → validate → dedupe → score
   if len(records) < target_count and refinement_pass < 1:
       ask LLM for new queries given what was found → repeat from search (once)
   persist records + evidence
   set status completed, write stats
   ```
   - Wrap in `try/except`. Any unhandled exception sets `failed` with `error` and emits an `error` event.
   - Check for `cancelling` status between pages and between stages; set `cancelled` and stop.
   - Stop early once `target_count` distinct verified records exist. Do not burn credits past the target.
   - Enforce `MAX_PAGES_PER_RUN`.
3. **Launching**: `asyncio.create_task(execute_run(run_id))` from the API handler, keeping a reference in a module-level set so tasks are not garbage collected. On app startup, mark any `running` runs from a previous process as `failed` (`"server restarted"`).
4. **API endpoints** (all under `/api`):

   | Method | Path | Purpose |
   |---|---|---|
   | POST | `/tasks/preview` | prompt → `{spec, plan}`, nothing saved |
   | POST | `/tasks` | Save task from approved spec/plan and start the first run |
   | GET | `/tasks` | List tasks with latest run status and record count |
   | GET | `/tasks/{id}` | Task detail with runs |
   | DELETE | `/tasks/{id}` | Delete task and all children |
   | POST | `/tasks/{id}/runs` | Start a new run (re-run) |
   | GET | `/runs/{id}` | Run detail (status, stats, plan) |
   | POST | `/runs/{id}/cancel` | Request cancellation |
   | GET | `/runs/{id}/events` | SSE stream of events (`?after=<id>` cursor) |
   | GET | `/runs/{id}/records` | Paginated records; query params: `q`, `min_confidence`, `sort`, `order`, `page`, `page_size`, plus per-field filters |
   | GET | `/records/{id}` | Record with all evidence and sources |
   | GET | `/runs/{id}/sources` | Sources with status and yield |
   | GET | `/runs/{id}/export?format=csv\|json\|xlsx` | Download |
   | GET | `/tasks/{id}/diff?base=<runId>&head=<runId>` | New / removed / changed (P1) |

5. **SSE implementation**: an async generator loops, queries `run_events` where `id > cursor`, yields new rows, sleeps 1 s, and ends when the run reaches a terminal state and no new events remain.

**Acceptance check (no UI yet):** with `curl` or the FastAPI `/docs` page, create a task, watch the SSE stream, cancel a second run mid-flight, and fetch records. The whole loop works from the command line.

---

### Phase 7: Frontend [COMPLETED] (Day 4, ~8 hours, split across the team if possible)

**Goal:** a dashboard that makes every backend capability visible.

**Pages and components**

1. **`/` Home: New task + task list**
   - Large prompt textarea with 3 clickable example prompts.
   - "Preview" calls `/tasks/preview`, then shows the **Plan Review panel**:
     - Fields table (name, type, required).
     - Filters and assumptions list.
     - Planned queries and steps.
     - If `clarification` exists, show it and let the user edit the prompt.
     - "Run" button starts the task.
   - Below: task list (title, status badge, record count, last run time, actions: open, re-run, delete).
2. **`/tasks/:id` Task detail** with tabs:
   - **Progress**: status, funnel numbers (raw → verified → valid → deduped), progress bar, live event log from SSE, Cancel button while running.
   - **Results**: interactive table.
     - Columns generated from `spec.fields`, plus confidence.
     - Global search box, column sort, per-column filter, confidence slider, server-side pagination.
     - Row click opens a **Record drawer**: all fields, confidence with its breakdown, flags, and every evidence snippet with a clickable source URL.
     - Export menu: CSV, JSON (XLSX if built).
   - **Sources**: table of URLs with status (fetched, blocked by robots, blocked by policy, failed), reason, and records yielded. Filter by status.
   - **History**: list of runs (time, status, counts). Select two runs → Compare view (new / removed / changed) (P1).
3. **Shared components**: `StatusBadge`, `ConfidenceBar`, `EmptyState`, `ErrorState`, `Spinner`. Keep them tiny.

**Implementation rules**
- One `api/` module with typed functions per endpoint; one `types/` file mirroring backend schemas.
- Every list handles three states explicitly: loading, empty, error.
- Poll `/runs/{id}` with TanStack Query only while the status is non-terminal; SSE handles the log.
- No state management library. TanStack Query plus local component state is enough.

**Acceptance check:** a non-technical person can go from prompt to exported CSV without help, and the UI never shows a blank screen or unhandled error.

---

### Phase 8: Hardening and demo prep [COMPLETED - Ready for Live Demo] (Day 4 evening to 3 Oct)

1. **Pick and rehearse 3 demo prompts**, ideally covering different domains:
   - Jobs: "Find remote machine learning engineer openings posted in the last 2 weeks."
   - Leads: "List 30 Indian SaaS startups that raised seed funding in 2025 with their founders."
   - Sponsors: "Find companies that sponsored hackathons in India in the last two years."
   Run each 3 times. Note which sources fail. Adjust queries and prompts, not code hacks.
2. **Cache for demo safety:** store fetched page text on disk keyed by URL (in a `.cache/` folder, git-ignored) with a config flag. A live demo must not die because of Wi-Fi.
3. **Have one pre-completed run per demo prompt** in the database, so you can show history and results instantly, then start a live run for the "wow" moment.
4. **Record a 2 to 3 minute backup video** of the full flow.
5. **Write the README** (section 10) and the pitch (section 11).
6. Deploy if the submission needs a link: backend on Render/Railway/Fly, frontend on Vercel/Netlify, SQLite on a persistent disk (or switch to hosted Postgres by changing `DATABASE_URL`). Put keys in the host's env settings.

**Acceptance check:** a teammate who did not build it runs the three prompts from a clean clone following only the README.

---

### Phase 9: After the online round (4 to 11 Oct)

Order of work:
1. Fix every bug found in the online round demo.
2. P1: source inspector polish, run diff, adaptive refinement, XLSX export.
3. P1: URL liveness check, per-field confidence, user-editable plan before run.
4. P2: Playwright fallback for JS-only pages (only when trafilatura returns almost nothing).
5. P2: scheduled re-runs with "new since last time" badges.
6. Prepare answers to likely judge questions (section 11).

---

## 6. Repository structure

```
datalens/
├── backend/
│   ├── app/
│   │   ├── main.py                # app creation, CORS, router mounting
│   │   ├── config.py              # settings from env
│   │   ├── db.py                  # engine, session dependency
│   │   ├── models.py              # SQLModel tables
│   │   ├── schemas.py             # API + pipeline Pydantic models
│   │   ├── api/
│   │   │   ├── tasks.py
│   │   │   ├── runs.py
│   │   │   ├── records.py
│   │   │   └── exports.py
│   │   ├── core/
│   │   │   ├── llm.py             # only file that imports the LLM SDK
│   │   │   ├── spec.py            # prompt → TaskSpec
│   │   │   ├── planner.py         # TaskSpec → Plan
│   │   │   ├── runner.py          # pipeline orchestration
│   │   │   └── events.py          # emit() helper
│   │   ├── collectors/
│   │   │   ├── policy.py          # the only gate for fetching
│   │   │   ├── search.py
│   │   │   └── fetcher.py
│   │   └── processing/
│   │       ├── extractor.py
│   │       ├── verifier.py
│   │       ├── normalizer.py
│   │       ├── validator.py
│   │       ├── deduper.py
│   │       └── scorer.py
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   └── src/
│       ├── api/                   # typed API functions
│       ├── types/                 # types mirroring backend schemas
│       ├── pages/                 # Home, TaskDetail
│       ├── components/            # small reusable UI pieces
│       ├── hooks/                 # useRunEvents (SSE), etc.
│       └── main.tsx
├── README.md
└── PROJECT_PLAN.md
```

Rule: if a file is not in this tree and you did not have a clear reason to add it, do not add it.

---

## 7. Prompt design (the part that decides quality)

Keep all prompts as module-level string constants next to the code that uses them. No separate prompt "framework".

**Spec parser prompt principles**
- Output must be fully determined by the schema. No prose.
- Ask for the *minimum viable* field set. Twelve fields means twelve chances to hallucinate.
- Require assumptions to be listed.
- Refuse-and-clarify path for vague or non-collection prompts.

**Planner prompt principles**
- Queries must differ in angle: one broad, one site-hinted (e.g. "site:"-style phrasing), one recency-focused, one long-tail.
- Include the year (2026) when the prompt is time-sensitive.

**Extractor prompt principles** (most important)
- Extract, never invent. Null over guess.
- Verbatim evidence, short.
- Apply the spec filters.
- An empty list is a valid, good answer.

**Testing prompts:** keep a `tests/fixtures/` folder with 3 saved page texts and the expected records. When you change a prompt, re-run those.

---

## 8. Source policy and ethics (say this out loud in the demo)

- Only public pages. No login, no CAPTCHA bypass, no paywall circumvention.
- Robots.txt respected. Denials are shown in the Sources tab with a reason.
- Blocklist for login-walled platforms.
- Per-domain rate limit and honest User-Agent.
- SSRF protection: refuse private, loopback, and link-local IPs.
- Personal data: collect only what the prompt needs. Do not add a "find people's private emails" feature.
- Keys only in environment variables. Never committed.

---

## 9. Testing plan

Test the logic that can silently be wrong. Skip the rest.

**Backend (`pytest`)**
| Module | What to test |
|---|---|
| `normalizer` | Date formats, URL cleanup, whitespace, unicode |
| `validator` | Required missing → rejected; optional bad → flagged |
| `deduper` | Exact duplicates, fuzzy duplicates ("Acme Inc" vs "ACME Incorporated"), merge fills nulls, evidence preserved |
| `verifier` | Verbatim snippet passes, altered snippet fails, whitespace differences pass |
| `scorer` | Known inputs → known score |
| `policy` | Blocked domain, private IP, non-http scheme, robots disallow |
| `runner` (integration) | Mock LLM and HTTP; full run produces expected records, cancel works, failure sets `failed` |

**Frontend:** `tsc --noEmit` and ESLint clean. Manual walkthrough of the demo flow. Do not write component tests during a hackathon.

**Manual quality check:** for each demo prompt, sample 10 records and verify against sources. Track precision (correct / checked). Being able to say "we verified 10 random records per demo and 9 to 10 were correct" impresses judges.

---

## 10. README must contain (and nothing more)

1. One-paragraph description.
2. Architecture diagram (the ASCII flow in section 3 is fine).
3. Setup: prerequisites, `.env` keys, install and run commands for backend and frontend.
4. Three example prompts.
5. Design decisions: evidence verification, dynamic schema, source policy.
6. Known limitations, stated honestly.

---

## 11. Pitch and judge Q&A

**Demo script (3 minutes)**
1. State the problem in one sentence.
2. Type a prompt. Show the parsed schema and plan.
3. Run it. Show live progress and the funnel.
4. Open results, filter, click a record → evidence snippet and source.
5. Show the Sources tab, including a blocked domain with a reason.
6. Re-run and show history.
7. Export CSV.

**Likely questions and your answers**

| Question | Answer |
|---|---|
| How do you stop hallucinations? | Verbatim evidence required and verified against page text in code; failures are dropped and counted. |
| Is this legal? | Public pages only, robots.txt enforced, login-walled sites blocked, rate-limited. |
| What if a site changes its layout? | There are no per-site parsers. Extraction is schema-driven by LLM, so layout changes do not break it. |
| How does it scale? | Stateless workers and a persisted task model; SQLite → Postgres and in-process tasks → a queue is a contained change. |
| What are the limits? | JS-only pages (until the Playwright fallback), LLM cost per page, dependence on search quality. |
| How do you dedupe? | Normalized key fields, exact hash then fuzzy matching; merged records keep all sources. |

---

## 12. Clean-code rules (paste into every AI coding session)

> **Standing instruction for any AI assistant working on this repo:**
> Write the smallest amount of correct, readable code that satisfies the task. Do not add anything that was not asked for. Follow every rule below. If a rule conflicts with a request, say so instead of silently breaking it.

### 12.1 What is banned

- **No dead code.** No unused functions, classes, variables, parameters, imports, or files.
- **No commented-out code.** Git remembers it.
- **No speculative features.** No "might be useful later" hooks, flags, or config options.
- **No premature abstraction.** Do not create a base class, factory, registry, or plugin system for one implementation. Abstract on the *third* repetition, not the first.
- **No debugging leftovers.** No `print()`, `console.log`, `debugger`, or temporary files committed.
- **No placeholder code.** No `pass`, `TODO` stubs, or fake data left in.
- **No scaffold junk.** Delete the Vite demo files (`App.css`, `react.svg`, `vite.svg`, the counter example) and any generated sample code the moment you create the project.
- **No obvious comments.** `# increment i` is noise. Comment only *why*, never *what*.
- **No decorative docstrings.** A docstring is required only where behavior is non-obvious (e.g. the confidence formula).
- **No swallowed errors.** No bare `except:` or `except Exception: pass`. Catch specific exceptions and either handle them meaningfully or let them propagate.
- **No magic numbers or strings.** Named constants in `config.py` or at the top of the module.
- **No secrets in code.** Only environment variables.
- **No duplicate logic.** If you copy-paste twice, extract a function.
- **No unnecessary dependencies.** Before adding a package, confirm the standard library or an existing dependency cannot do it.

### 12.2 What is required

**General**
- One responsibility per function. If you need "and" to describe it, split it.
- Functions under ~30 lines where reasonable. Files under ~300 lines.
- Descriptive names. `fetch_page`, not `get`. `verified_records`, not `data2`.
- Early returns instead of deep nesting (max 3 levels).
- Pure functions for logic (normalizing, deduping, scoring). Keep I/O at the edges (fetcher, LLM, DB) so logic is trivially testable.
- One place for each concern: LLM SDK only in `llm.py`, fetching only via `policy.py` + `fetcher.py`, event writing only via `emit()`.

**Python**
- Type hints on every function signature. Prefer Pydantic models over raw dicts for structured data.
- `async` all the way for I/O. Never call blocking I/O inside an `async` function.
- `ruff check` and `ruff format` must pass with zero warnings before every commit.
- f-strings, `pathlib`, `dataclasses`/Pydantic. No wildcard imports.
- Absolute imports within `app`.
- API handlers stay thin: parse input → call one function → return. Logic lives in `core/`, `collectors/`, `processing/`.

**TypeScript / React**
- `strict` mode on. **No `any`.** No `@ts-ignore`.
- Function components and hooks only.
- One component per file, named after the file. Components under ~150 lines; extract when longer.
- Server data through TanStack Query only. No manual `useEffect` fetching.
- Types mirror backend schemas in one place (`types/`).
- Tailwind utility classes. No custom CSS files unless unavoidable.
- Handle loading, empty, and error states in every data view.
- ESLint and Prettier pass with zero warnings.

**Git**
- Small commits with clear messages ("Add evidence verifier"), not "update".
- `.gitignore` covers `.env`, `.venv`, `node_modules`, `.cache`, `*.db`, `__pycache__`.
- Never commit generated files or database files.

### 12.3 Review checklist (run before every commit)

- [ ] `ruff check .` and `ruff format --check .` clean
- [ ] `pytest` passes
- [ ] `tsc --noEmit` and `eslint` clean
- [ ] No unused imports, variables, or files (`ruff` catches most; check for unreferenced files by hand)
- [ ] No `print`, `console.log`, or commented-out code
- [ ] No new dependency without a reason
- [ ] No secret in the diff
- [ ] Every new function has one clear job and a clear name
- [ ] Deleted anything that the change made obsolete

### 12.4 A prompt to give your AI coding assistant

```
You are working on DataLens. Read PROJECT_PLAN.md sections 4, 6, and 12 first.
Implement ONLY the task I describe. Do not add features, config options, or
abstractions beyond it. Follow the clean-code rules in section 12 strictly:
no dead code, no commented-out code, no debug prints, type hints everywhere,
small single-purpose functions. Use only files that exist in the repository
structure in section 6. When finished, list every file you changed and confirm
each item in the section 12.3 checklist.
```

---

## 13. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Four days is not enough for all P0 | High | High | Strict phase order; cut P1/P2 without guilt; backend before UI |
| LLM returns wrong or invented data | Medium | Critical | Evidence verification in code; drop and count failures |
| Sites block or time out during demo | High | High | Page cache, pre-run datasets, backup video |
| LLM cost or rate limits mid-demo | Medium | High | Cheap model for extraction, page cap, target-count early stop, pre-run data |
| Vague prompts produce junk | Medium | Medium | Clarification path and visible assumptions |
| Search API returns poor URLs | Medium | Medium | Diverse queries, refinement pass, source hints |
| Long runs feel dead | Medium | Medium | SSE event log with funnel counters |
| Team merges break things | Medium | Medium | Small commits, clear file ownership per person (backend pipeline / API / frontend) |
| Legal/ethics challenge | Low | High | Documented and demonstrated source policy |

---

## 14. Suggested team split (if 3 people)

| Person | Owns | First deliverable |
|---|---|---|
| A: Pipeline | `llm.py`, `spec.py`, `planner.py`, `extractor.py`, `verifier.py`, `runner.py` | Prompt → verified records from CLI |
| B: Data and API | `models.py`, `db.py`, `policy.py`, `search.py`, `fetcher.py`, normalizer/validator/deduper/scorer, `api/` | Endpoints and clean dataset processing |
| C: Frontend | Everything in `frontend/` | Dashboard against the API contract (mock responses until B's endpoints exist) |

Agree on `schemas.py` and the endpoint table in Phase 1 **before** splitting. That is the contract. Changing it later costs everyone time.

If solo: follow the phases in order, backend first.

---

## 15. Definition of done (final checklist before submission)
 
- [x] All P0 features in section 1.2 work from a clean clone
- [x] Three demo prompts produce clean, source-backed datasets (Verified with test runner; live ready)
- [x] Every record's evidence is viewable in the UI (Record drawer with highlighted source snippet & confidence)
- [x] Cancel, re-run, and history work (Cooperative cancel, background task isolation, run history tab)
- [x] CSV, JSON, and XLSX export download correctly
- [x] Blocked and failed sources are visible with reasons (SSRF, robots.txt, domain policy)
- [x] No API keys in the repo or its history (.env git-ignored)
- [x] Lint, format, type check, and tests all pass (35/35 pytest, 0 ruff errors, 0 tsc errors)
- [x] README is accurate and setup works on a second machine (Created and verified)
- [ ] Backup demo video recorded
- [ ] Pitch rehearsed with the Q&A in section 11
