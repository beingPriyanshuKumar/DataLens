export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  accordion?: {
    summary: string;
    details: string;
  }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "quick-start",
    title: "1. Quick Start",
    summary: "From prompt to verified dataset in under two minutes.",
    content: `
DataLens operates in four distinct stages:

1. **Describe:** Type a plain English description of the records you need (e.g., "Find YC Winter 2026 AI startups that raised seed rounds").
2. **Review Plan:** DataLens infers entity schemas, identifying key fields, filters, and targeted search queries. Review and refine the schema before execution.
3. **Watch It Run:** Pages are crawled, filtered by robots.txt and safety policies, and parsed. Watch live extracted records stream onto your screen.
4. **Explore & Export:** View records backed by direct source citations and confidence scores. Export clean CSV, Excel, or JSON.
    `,
  },
  {
    id: "prompt-writing",
    title: "2. Writing a Good Prompt",
    summary: "Clear instructions yield significantly higher recall and precision.",
    content: `
A strong prompt identifies four key elements:
- **What:** The specific entity (e.g., "Seed stage fintech startups", "Machine learning jobs").
- **Filters:** Bounds such as timeframe, location, funding stage, or industry.
- **Where:** Geographic market (or use the Search Region selector).
- **How many:** Target count (e.g., "50 leads").

### Prompt Comparison

| Weak Prompt | Strong Prompt | Why It Matters |
|---|---|---|
| "tech jobs" | "Senior Frontend Engineer jobs in Berlin offering > 80k EUR" | Specific role, location, and compensation filter prevents irrelevant listings |
| "startups" | "Indian B2B SaaS companies founded in 2024 or 2025 with seed funding" | Grounded geographic and temporal constraints guide planner queries |
| "sponsors" | "Corporate sponsors of major AI and ML hackathons in 2025-2026" | Targets aggregator pages, directories, and sponsor tiers |
    `,
  },
  {
    id: "choosing-region",
    title: "3. Choosing a Search Region",
    summary: "How geographic scoping shifts queries and content retrieval.",
    content: `
The Region selector biases search engine queries toward national or local sources and guides currency and language preferences (e.g., defaulting to INR and Indian job portals when India is selected).

**What it does:**
- Directs search providers to national indexes and local domains.
- Infers currency symbols (e.g., INR, USD, EUR, GBP) without hardcoding them into schema field names.
- Guides planner queries to incorporate regional hub terms.

**What it does not do:**
- It is a search bias, not an absolute firewall. A query scoped to Germany may still retrieve global aggregator pages if they rank highest.
    `,
  },
  {
    id: "reviewing-plan",
    title: "4. Reviewing the Plan",
    summary: "Schema definition, identifying keys, and search query strategy.",
    content: `
Before crawling begins, DataLens generates a TaskSpec:
- **Key Fields:** The minimal combination of fields that uniquely identify an entity (e.g., company + title + location). At most 3 fields are marked required to maximize completeness.
- **Field Types:** Strict scalar and structured types: str, int, float, bool, date, url, email.
- **Search Queries:** 3 to 6 distinct queries exploring aggregators, directories, roundups, and primary sources.
- **Assumptions:** Explicit boundary assumptions made by the model.
    `,
  },
  {
    id: "watching-run",
    title: "5. Watching a Run & Monitoring",
    summary: "Live progress, funnel stats, and cancellation semantics.",
    content: `
During execution, watch the live pipeline funnel:
\`Candidate URLs → Fetched OK → Extracted Raw → Verified Quotes → Valid Schema → Deduped Records\`

- **Live Streaming:** Records stream onto the table in real-time as pages are processed.
- **Cancellation:** Clicking 'CANCEL' terminates background page fetching cleanly after completing the in-flight request.
- **Queued State:** If concurrent runs exceed capacity (default 2), your run waits in a FIFO queue until a worker slot is freed.
    `,
  },
  {
    id: "exploring-results",
    title: "6. Exploring Results & Evidence Drawer",
    summary: "Every field is backed by verbatim source quotes.",
    content: `
Clicking any row in the Results table opens the Evidence Drawer:
- **Verbatim Snippet:** The exact quote from the webpage where the data was located.
- **Source URL:** Direct clickable link, strictly sanitized to prevent dangerous URI schemes (XSS prevention).
- **Confidence Metric:** Composite score reflecting quote presence, field grounding, and schema completeness.
    `,
  },
  {
    id: "checking-sources",
    title: "7. Checking Sources & Policy Compliance",
    summary: "Transparent audit log of every visited domain.",
    content: `
The Sources tab shows all candidate URLs with their retrieval status:
- **FETCHED:** Page successfully retrieved and parsed.
- **VIA_SEARCH_PROVIDER:** Direct fetch encountered technical blockage (timeout, JS shell); content verified against provider-supplied text snippets.
- **BLOCKED_BY_ROBOTS:** Page disallowed by website's robots.txt rules.
- **BLOCKED_BY_POLICY:** Prohibited domain (e.g. login-walled social networks) or private IP range.
- **FAILED:** Network failure, 404, or non-HTML content.
    `,
  },
  {
    id: "exporting",
    title: "8. Exporting Clean Data",
    summary: "Export to CSV, Excel, and JSON with formula injection protection.",
    content: `
Download your dataset at any time:
- **CSV:** Sanitized against CSV / Formula Injection (\`=\`, \`+\`, \`-\`, \`@\` prefixed values are neutralized).
- **Excel (.xlsx):** Structured workbook with column headers and formatting.
- **JSON:** Complete entity array including evidence quotes, confidence scores, and source URLs.
    `,
  },
  {
    id: "troubleshooting",
    title: "9. Troubleshooting & FAQ",
    summary: "Common questions and edge case explanations.",
    content: "Detailed troubleshooting advice for frequent scenarios.",
    accordion: [
      {
        summary: "Why did my prompt return few or zero records?",
        details: "Common causes: overly restrictive filters, target websites heavily protected by Cloudflare bot walls, or JavaScript-only single-page applications. Try broadening the prompt keywords or selecting a more specific region.",
      },
      {
        summary: "Why are some fields null?",
        details: "DataLens enforces strict grounding: if an attribute (like salary or email) is not explicitly stated in the source text, it is recorded as null rather than hallucinated or guessed.",
      },
      {
        summary: "Why are social media sites blocked?",
        details: "DataLens respects website terms of service and robots.txt policies. Login-walled platforms (LinkedIn, Twitter/X, Instagram, Facebook) are blocked by design.",
      },
      {
        summary: "Why was my run queued?",
        details: "To protect server memory and comply with third-party rate limits, the runner limits concurrent crawls. Your run begins automatically once earlier tasks finish.",
      },
    ],
  },
  {
    id: "glossary",
    title: "10. Glossary",
    summary: "Key terminology used throughout DataLens.",
    content: `
- **Grounding:** Verification that an extracted field value appears explicitly in the source page text.
- **Hallucinated:** A candidate record whose supporting evidence quote could not be located in the page HTML.
- **Deduplication:** Merging duplicate records sharing the same key fields while preserving all distinct source evidence links.
- **Provenance:** The audit trail linking each record to its origin URL, HTTP status, and timestamp.
    `,
  },
];
