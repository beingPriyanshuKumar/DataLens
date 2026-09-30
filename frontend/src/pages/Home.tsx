import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Button from "../components/Button";
import HeroArt from "../components/HeroArt";
import StatStrip, { type StatItem } from "../components/StatStrip";
import StatusPill from "../components/StatusPill";
import { TEMPLATES } from "../templates";
import { getPlatformStats, listTasks } from "../api";
import type { TaskItem } from "../types";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "DataLens — AI-Powered Structured Data Intelligence";
    window.scrollTo(0, 0);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: getPlatformStats,
    refetchInterval: 15000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ["tasks-recent"],
    queryFn: () => listTasks({ limit: 3, sort: "created_at", order: "desc" }),
  });

  const recentTasks: TaskItem[] = tasksData?.items || [];

  const statsItems: StatItem[] = [
    { id: "records", label: "RECORDS COLLECTED", value: stats?.records_verified ?? 0 },
    { id: "sources", label: "SOURCES CHECKED", value: stats?.sources_checked ?? 0 },
    { id: "tasks", label: "TASKS RUN", value: stats?.tasks ?? 0 },
    {
      id: "blocked",
      label: "UNSUPPORTED RECORDS BLOCKED",
      value: stats?.unsupported_records_blocked ?? 0,
      variant: (stats?.unsupported_records_blocked ?? 0) > 0 ? "alert" : undefined,
    },
  ];

  const handleTemplateClick = (templateId: string) => {
    const tmpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    const defaults: Record<string, string> = {};
    tmpl.slots.forEach((s) => {
      defaults[s.id] = s.defaultValue || "";
    });
    const promptText = tmpl.assemblePrompt(defaults);
    navigate(`/collect?prompt=${encodeURIComponent(promptText)}`);
  };

  return (
    <div className="page-shell home-page">
      <Header />
      <main id="main-content" className="home-main" role="main">
        {/* SECTION 1: HERO */}
        <section className="home-hero">
          <div className="home-hero__left">
            <span className="home-hero__badge font-mono">// AUTONOMOUS EXTRACTION &amp; VERIFICATION</span>
            <h1 className="home-hero__title">Turn a sentence into a verified dataset.</h1>
            <p className="home-hero__subcopy">
              Describe the data you need. DataLens plans the search, collects from permitted public sources,
              and backs every record with a quote from its source page.
            </p>
            <div className="home-hero__cta-row">
              <Button variant="primary" onClick={() => navigate("/collect")}>
                START COLLECTING ↗
              </Button>
              <Button variant="ghost" onClick={() => navigate("/guide")}>
                HOW IT WORKS
              </Button>
            </div>
            <p className="home-hero__note">
              Records that can&apos;t be traced to their source are dropped, not guessed.
            </p>
          </div>
          <div className="home-hero__right" aria-hidden="true">
            <HeroArt />
          </div>
        </section>

        {/* SECTION 2: LIVE STATS STRIP */}
        <section className="home-stats-strip">
          <StatStrip stats={statsItems} />
        </section>

        {/* SECTION 3: WHAT YOU CAN ASK (TEMPLATES) */}
        <section className="home-section">
          <div className="home-section__header">
            <span className="home-label font-mono">01 / TEMPLATES &amp; COOKBOOK</span>
            <h2 className="home-section__title">What You Can Ask</h2>
            <p className="home-section__desc">Select a preset to launch a preconfigured collection task in Collect.</p>
          </div>
          <div className="home-templates-grid">
            {TEMPLATES.slice(0, 6).map((tmpl) => (
              <div
                key={tmpl.id}
                className="home-template-card"
                onClick={() => handleTemplateClick(tmpl.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleTemplateClick(tmpl.id);
                  }
                }}
              >
                <div className="home-template-card__cat font-mono">{tmpl.category}</div>
                <h3 className="home-template-card__title">{tmpl.title}</h3>
                <p className="home-template-card__desc">{tmpl.description}</p>
                <span className="home-template-card__action font-mono">USE TEMPLATE ↗</span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS */}
        <section className="home-section">
          <div className="home-section__header">
            <span className="home-label font-mono">02 / ARCHITECTURE WORKFLOW</span>
            <h2 className="home-section__title">How It Works</h2>
          </div>
          <div className="home-workflow-grid">
            <div className="home-workflow-cell">
              <span className="home-workflow-num font-mono">01</span>
              <h3 className="home-workflow-head">DESCRIBE</h3>
              <p className="home-workflow-text">
                Type what you need in plain English. We infer entity schemas, field bounds, and targeted queries.
              </p>
            </div>
            <div className="home-workflow-cell">
              <span className="home-workflow-num font-mono">02</span>
              <h3 className="home-workflow-head">REVIEW THE PLAN</h3>
              <p className="home-workflow-text">
                Inspect suggested fields, required flags, regional bias, and search terms before crawling starts.
              </p>
            </div>
            <div className="home-workflow-cell">
              <span className="home-workflow-num font-mono">03</span>
              <h3 className="home-workflow-head">WATCH IT RUN</h3>
              <p className="home-workflow-text">
                Pages are fetched respecting robots.txt, parsed, and streamed live as verified records onto your screen.
              </p>
            </div>
            <div className="home-workflow-cell">
              <span className="home-workflow-num font-mono">04</span>
              <h3 className="home-workflow-head">EXPLORE AND EXPORT</h3>
              <p className="home-workflow-text">
                Inspect verbatim source quotes in the evidence drawer, and export clean CSV, Excel, or JSON.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: WHY YOU CAN TRUST IT */}
        <section className="home-section">
          <div className="home-section__header">
            <span className="home-label font-mono">03 / TRUST PRINCIPLES</span>
            <h2 className="home-section__title">Why You Can Trust It</h2>
          </div>
          <div className="home-trust-grid">
            <div className="home-trust-cell">
              <h3 className="home-trust-head">Source-Backed</h3>
              <p className="home-trust-text">
                Every extracted record links directly to its source URL with a verbatim citation quote verified against page text.
              </p>
            </div>
            <div className="home-trust-cell">
              <h3 className="home-trust-head">Permitted Sources Only</h3>
              <p className="home-trust-text">
                robots.txt is strictly honored; login-walled social networks and private IP ranges are blocked by policy.
              </p>
            </div>
            <div className="home-trust-cell">
              <h3 className="home-trust-head">Live Progress</h3>
              <p className="home-trust-text">
                Real-time streaming pipeline displays funnel metrics (raw, verified, valid, deduped) as pages complete.
              </p>
            </div>
            <div className="home-trust-cell">
              <h3 className="home-trust-head">Export Anywhere</h3>
              <p className="home-trust-text">
                Download structured datasets in sanitized CSV with formula injection defense, Excel, or JSON.
              </p>
            </div>
          </div>
          <div className="home-trust-footer">
            <Link to="/trust" className="home-trust-link font-mono">
              READ SOURCE POLICY &amp; SYSTEM HEALTH DETAILS →
            </Link>
          </div>
        </section>

        {/* SECTION 6: RECENT TASKS */}
        <section className="home-section home-section--last">
          <div className="home-section__header home-section__header--flex">
            <div>
              <span className="home-label font-mono">04 / RECENT ACTIVITY</span>
              <h2 className="home-section__title">Recent Tasks</h2>
            </div>
            <Button variant="secondary" size="small" onClick={() => navigate("/tasks")}>
              VIEW ALL TASKS ↗
            </Button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="home-tasks-empty">
              <p>No tasks yet. Start your first one.</p>
              <Button variant="primary" size="small" onClick={() => navigate("/collect")}>
                START FIRST TASK ↗
              </Button>
            </div>
          ) : (
            <div className="home-tasks-list">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="home-task-row"
                  onClick={() => navigate(`/collect/${t.id}`)}
                >
                  <div className="home-task-info">
                    <span className="home-task-title">{t.title || "Untitled Task"}</span>
                    <span className="home-task-region font-mono">REGION: {t.region || "GLOBAL"}</span>
                  </div>
                  <div className="home-task-meta">
                    <StatusPill status={(t.latest_run?.status || "pending") as any} />
                    <span className="home-task-records font-mono">
                      {t.latest_run?.record_count ?? 0} records
                    </span>
                    <span className="home-task-open font-mono">OPEN ↗</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
