import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import Footer from "../components/Footer";
import StatStrip from "../components/StatStrip";
import StatusPill from "../components/StatusPill";
import { getPolicy, getSystemDiagnostics, getPlatformStats } from "../api";
import "./Trust.css";

export default function Trust() {
  useEffect(() => {
    document.title = "Trust & Governance — DataLens";
    window.scrollTo(0, 0);
  }, []);

  const { data: policy } = useQuery({
    queryKey: ["policy"],
    queryFn: getPolicy,
  });

  const { data: diag, isLoading: diagLoading } = useQuery({
    queryKey: ["diagnostics"],
    queryFn: getSystemDiagnostics,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: getPlatformStats,
    refetchInterval: 15000,
  });

  const statsItems = [
    { id: "verified", label: "RECORDS VERIFIED", value: stats?.records_verified ?? 0 },
    { id: "sources", label: "SOURCES CHECKED", value: stats?.sources_checked ?? 0 },
    { id: "tasks", label: "TASKS RUN", value: stats?.tasks ?? 0 },
    {
      id: "unsupported",
      label: "UNSUPPORTED DROPPED",
      value: stats?.unsupported_records_blocked ?? 0,
      variant: (stats?.unsupported_records_blocked ?? 0) > 0 ? ("alert" as const) : undefined,
    },
  ];

  return (
    <div className="page-shell trust-page">
      <Header />
      <main id="main-content" className="trust-main" role="main">
        {/* Title Row */}
        <section className="trust-hero">
          <span className="trust-hero__badge font-mono">// GOVERNANCE & INTEGRITY</span>
          <h1 className="trust-hero__title">Trust, Provenance & Source Policy</h1>
          <p className="trust-hero__subtitle">
            Every record produced by DataLens is backed by an auditable quote from a public web page.
            We honor robots.txt, respect rate limits, and drop unverified claims rather than guess.
          </p>
        </section>

        {/* Platform Numbers */}
        <section className="trust-section trust-section--flush">
          <div className="trust-section__header">
            <span className="trust-label font-mono">01 / PLATFORM METRICS</span>
            <h2>Aggregate Run Numbers</h2>
          </div>
          <StatStrip stats={statsItems} />
        </section>

        {/* Live System Diagnostics */}
        <section className="trust-section">
          <div className="trust-section__header">
            <span className="trust-label font-mono">02 / LIVE SYSTEM HEALTH</span>
            <h2>Engine & Provider Connectivity</h2>
            <p className="trust-desc">Real-time status of backend subsystems. Local verification engine active.</p>
          </div>
          <div className="trust-status-grid">
            <div className="trust-status-card">
              <div className="trust-status-card__head">
                <span className="trust-status-card__name">Language Model</span>
                {diagLoading ? (
                  <StatusPill status="queued" />
                ) : diag?.llm?.ok ? (
                  <StatusPill status="completed" />
                ) : (
                  <StatusPill status="failed" />
                )}
              </div>
              <p className="trust-status-card__meta font-mono">
                Provider: {diag?.llm?.provider || "Configured Provider"}
              </p>
              {diag?.llm?.error && <p className="trust-status-card__err">{diag.llm.error}</p>}
            </div>

            <div className="trust-status-card">
              <div className="trust-status-card__head">
                <span className="trust-status-card__name">Web Search Provider</span>
                {diagLoading ? (
                  <StatusPill status="queued" />
                ) : diag?.search?.ok ? (
                  <StatusPill status="completed" />
                ) : (
                  <StatusPill status="failed" />
                )}
              </div>
              <p className="trust-status-card__meta font-mono">
                Provider: {diag?.search?.provider || "Search Provider"}
              </p>
              {diag?.search?.note && <p className="trust-status-card__note">{diag.search.note}</p>}
            </div>

            <div className="trust-status-card">
              <div className="trust-status-card__head">
                <span className="trust-status-card__name">Local Database</span>
                {diagLoading ? (
                  <StatusPill status="queued" />
                ) : diag?.database?.ok ? (
                  <StatusPill status="completed" />
                ) : (
                  <StatusPill status="failed" />
                )}
              </div>
              <p className="trust-status-card__meta font-mono">SQLite (WAL Mode &amp; Foreign Keys)</p>
            </div>
          </div>
        </section>

        {/* Source Policy Facts */}
        <section className="trust-section">
          <div className="trust-section__header">
            <span className="trust-label font-mono">03 / SOURCE POLICY FACTS</span>
            <h2>Automated Crawler Limits &amp; Ethics</h2>
            <p className="trust-desc">Enforced at runtime by the policy gate before any network request.</p>
          </div>

          <div className="trust-policy-grid">
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">robots.txt</span>
              <span className="trust-policy-item__v">Strictly Honored (Disallowed paths refused)</span>
            </div>
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">User Agent</span>
              <span className="trust-policy-item__v font-mono">{policy?.user_agent || "DataLensBot/1.0"}</span>
            </div>
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">Domain Delay</span>
              <span className="trust-policy-item__v font-mono">{policy?.per_domain_delay_seconds ?? 1.0}s per host</span>
            </div>
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">Max Concurrent Runs</span>
              <span className="trust-policy-item__v font-mono">{policy?.max_concurrent_runs ?? 2} runs</span>
            </div>
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">Max Page Size</span>
              <span className="trust-policy-item__v font-mono">
                {policy ? Math.round(policy.max_response_bytes / 1024) : 2048} KB
              </span>
            </div>
            <div className="trust-policy-item">
              <span className="trust-policy-item__k font-mono">SSRF Prevention</span>
              <span className="trust-policy-item__v">Loopback, private subnets (RFC 1918), and link-local blocked</span>
            </div>
          </div>

          {policy?.blocked_domains && policy.blocked_domains.length > 0 && (
            <details className="trust-blocked-details">
              <summary className="trust-blocked-summary font-mono">
                VIEW BLOCKED DOMAINS ({policy.blocked_domains.length} login-walled / private networks)
              </summary>
              <div className="trust-blocked-list">
                {policy.blocked_domains.map((dom) => (
                  <span key={dom} className="trust-blocked-tag font-mono">
                    {dom}
                  </span>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* How Verification Works */}
        <section className="trust-section">
          <div className="trust-section__header">
            <span className="trust-label font-mono">04 / VERIFICATION MECHANICS</span>
            <h2>Field-Level Grounding Illustrated</h2>
          </div>
          <div className="trust-grounding-demo">
            <div className="trust-demo-box">
              <div className="trust-demo-box__title font-mono">// 1. EXTRACTED ENTITY RECORD</div>
              <pre className="trust-demo-code">
{`{
  "company": "Acme Robotics",
  "funding_amount": "$4.5M",
  "location": "Bengaluru",
  "founders": "Priya Sharma, Rohan Verma"
}`}
              </pre>
            </div>
            <div className="trust-demo-arrow">→ Verified Against Verbatim Quote →</div>
            <div className="trust-demo-box">
              <div className="trust-demo-box__title font-mono">// 2. SOURCE PAGE EVIDENCE QUOTE</div>
              <blockquote className="trust-demo-quote">
                &ldquo;...Bengaluru-based Acme Robotics announced today that it raised a $4.5M seed round led by Nexus.
                Founders Priya Sharma and Rohan Verma stated...&rdquo;
              </blockquote>
              <div className="trust-demo-verdict">
                <span className="trust-verdict-pill">QUOTE FOUND ON PAGE</span>
                <span className="trust-verdict-pill">ALL 4 FIELDS GROUNDED</span>
              </div>
            </div>
          </div>
          <div className="trust-guarantees">
            <div className="trust-guarantee-card">
              <h4>What We Guarantee</h4>
              <ul>
                <li>The supporting quote is present verbatim in the downloaded page HTML.</li>
                <li>Every non-null field value appears explicitly in the supporting quote.</li>
                <li>Duplicate records across multiple search queries are deduplicated.</li>
              </ul>
            </div>
            <div className="trust-guarantee-card trust-guarantee-card--caution">
              <h4>What Is Not Guaranteed</h4>
              <ul>
                <li>A source website may itself publish outdated or inaccurate information.</li>
                <li>Search engine rankings dictate candidate links; ranking biases can exist.</li>
                <li>JavaScript-rendered single page apps without SSR may yield partial text.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Known Limitations & Data Privacy */}
        <section className="trust-section">
          <div className="trust-section__header">
            <span className="trust-label font-mono">05 / LIMITATIONS &amp; PRIVACY</span>
            <h2>Honest Boundaries</h2>
          </div>
          <div className="trust-limits-grid">
            <div className="trust-limit-item">
              <h3>JavaScript-Heavy SPAs</h3>
              <p>
                DataLens uses an asynchronous HTTP streaming engine. Pages that require complex client-side
                JavaScript execution to reveal text may return empty content.
              </p>
            </div>
            <div className="trust-limit-item">
              <h3>Region Bias</h3>
              <p>
                Selecting a region prioritizes local top-level domains, language hints, and currency cues, but
                does not guarantee all retrieved sources originate within that border.
              </p>
            </div>
            <div className="trust-limit-item">
              <h3>Local Data Storage</h3>
              <p>
                All data is stored exclusively in your local database. Deleting a task permanently purges all
                associated runs, records, and raw HTML traces.
              </p>
            </div>
            <div className="trust-limit-item">
              <h3>Permitted Usage</h3>
              <p>
                DataLens is engineered for public corporate intelligence, market research, and directory aggregation.
                Do not attempt to scrape private personal data or bypass authentication.
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="trust-about-strip">
          <span className="font-mono">DATALENS v0.1.0</span>
          <span>·</span>
          <span>MIT LICENSE (TEAM CODECUBICLE)</span>
          <span>·</span>
          <a
            href="https://github.com/beingPriyanshuKumar/codecubicle"
            target="_blank"
            rel="noopener noreferrer"
            className="trust-link"
          >
            VIEW SOURCE CODE ON GITHUB ↗
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
