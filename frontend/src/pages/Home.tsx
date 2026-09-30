import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "../components/Header";
import Button from "../components/Button";
import StatusPill from "../components/StatusPill";
import StatStrip, { type StatItem } from "../components/StatStrip";
import DataTable, { type Column } from "../components/DataTable";
import SparkleIcon from "../components/SparkleIcon";
import HeroArt from "../components/HeroArt";
import StateBlock from "../components/StateBlock";
import { listTasks, previewTask, createTask, deleteTask, createRun, getPlatformStats } from "../api";
import type { PreviewResponse, TaskSummary, PlatformStats } from "../types";
import "./Home.css";

const EXAMPLE_PROMPTS = [
  "Find remote machine learning engineer openings posted in the last 2 weeks",
  "List 30 Indian SaaS startups that raised seed funding in 2025 with their founders",
  "Find companies that sponsored hackathons in India in the last two years",
];

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "demo") {
      return {
        spec: {
          title: "Remote Machine Learning Engineer Openings",
          entity: "job_posting",
          fields: [
            { name: "title", type: "str", description: "Job title", required: true },
            { name: "company", type: "str", description: "Company name", required: true },
            { name: "location", type: "str", description: "Remote or location", required: true },
            { name: "posted_date", type: "date", description: "Date posted", required: false },
          ],
          filters: { remote: "true", max_age_days: "14" },
          key_fields: ["title", "company"],
          target_count: 30,
          source_hints: ["lever.co", "greenhouse.io"],
          assumptions: ["Only software engineering and ML roles", "English job postings only"],
          clarification: null,
        },
        plan: {
          queries: [
            "remote machine learning engineer jobs 2026",
            "site:greenhouse.io machine learning engineer remote",
          ],
          steps: [
            { type: "search", description: "Search allowed job boards and careers pages" },
            { type: "fetch", description: "Fetch permitted pages respecting robots.txt" },
            { type: "extract", description: "Extract title, company, location, and dates" },
            { type: "validate", description: "Validate verbatim source quotes on page" },
            { type: "dedupe", description: "Deduplicate across multiple job boards" },
          ],
          max_pages: 20,
        },
      };
    }
    return null;
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Queries
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery<TaskSummary[]>({
    queryKey: ["tasks"],
    queryFn: listTasks,
  });

  const { data: statsData } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: getPlatformStats,
    refetchInterval: 10000,
  });

  // Mutations
  const previewMutation = useMutation({
    mutationFn: (p: string) => previewTask(p),
    onSuccess: (data) => {
      setPreviewData(data);
      const reviewEl = document.getElementById("plan-review");
      if (reviewEl) {
        reviewEl.scrollIntoView({ behavior: "smooth" });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!previewData || !previewData.plan) return;
      return createTask(prompt, previewData.spec, previewData.plan);
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
        navigate(`/tasks/${data.task_id}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      setDeleteConfirmId(null);
    },
  });

  const reRunMutation = useMutation({
    mutationFn: (taskId: string) => createRun(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      navigate(`/tasks/${taskId}`);
    },
  });

  const handlePreview = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || previewMutation.isPending) return;
    previewMutation.mutate(prompt.trim());
  };

  const scrollToTasks = () => {
    const el = document.getElementById("tasks");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToPrompt = () => {
    const el = document.getElementById("prompt-input");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  };

  // Platform stats items
  const statItems: StatItem[] = [
    {
      id: "records",
      value: statsData ? statsData.records_verified : 0,
      label: "Records verified",
    },
    {
      id: "sources",
      value: statsData ? statsData.sources_checked : 0,
      label: "Sources checked",
    },
    {
      id: "tasks",
      value: statsData ? statsData.tasks : 0,
      label: "Tasks run",
    },
    {
      id: "blocked",
      value: statsData ? statsData.unsupported_records_blocked : 0,
      label: "Unsupported records blocked",
      variant: "alert",
    },
  ];

  // Tasks columns
  const taskColumns: Column<TaskSummary>[] = [
    {
      key: "title",
      label: "TASK",
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t.title}</div>
          <div
            className="type-small"
            style={{
              color: "var(--color-ink-muted)",
              maxWidth: "400px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t.prompt}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "STATUS",
      render: (t) => <StatusPill status={t.status} />,
    },
    {
      key: "record_count",
      label: "RECORDS",
      isMono: true,
      render: (t) => <span>{t.record_count}</span>,
    },
    {
      key: "last_run_at",
      label: "LAST RUN",
      isMono: true,
      render: (t) => (
        <span>
          {t.last_run_at
            ? new Date(t.last_run_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "ACTIONS",
      render: (t) => (
        <div
          className="tasks-table__actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            onClick={() => navigate(`/tasks/${t.id}`)}
            aria-label={`Open task ${t.title}`}
          >
            OPEN ↗
          </Button>
          <Button
            variant="secondary"
            onClick={() => reRunMutation.mutate(t.id)}
            disabled={reRunMutation.isPending}
            aria-label={`Re-run task ${t.title}`}
          >
            RE-RUN
          </Button>
          {deleteConfirmId === t.id ? (
            <div style={{ display: "inline-flex", gap: "4px" }}>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(t.id)}
                disabled={deleteMutation.isPending}
              >
                CONFIRM?
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirmId(null)}
              >
                ✕
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              onClick={() => setDeleteConfirmId(t.id)}
              aria-label={`Delete task ${t.title}`}
            >
              DELETE
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="app-viewport">
      <div className="app-frame">
        {/* Row 1: Header */}
        <Header />

        {/* Row 2: Hero */}
        <div className="grid-row home-hero">
          {/* Left Cell */}
          <div className="grid-cell home-hero__content">
            <div className="home-hero__headline-wrapper">
              <div className="home-hero__sparkle">
                <SparkleIcon size={48} color="var(--color-ink)" />
              </div>
              <h1 className="home-hero__headline">
                Turn a sentence
                <br />
                into a verified
                <br />
                dataset.
              </h1>
            </div>

            <p className="home-hero__subcopy">
              Describe the data you need. DataLens plans the collection, gathers it
              from permitted public sources, and proves every record with a quote
              from the page.
            </p>

            {/* Prompt Box */}
            <form onSubmit={handlePreview} className="prompt-box">
              <textarea
                id="prompt-input"
                className="prompt-box__textarea"
                rows={3}
                placeholder="Find remote machine learning engineer openings posted in the last 2 weeks"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePreview(e);
                  }
                }}
              />
              <div className="prompt-box__footer">
                <div className="prompt-box__actions">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!prompt.trim() || previewMutation.isPending}
                  >
                    {previewMutation.isPending ? "PLANNING…" : "PREVIEW PLAN"}
                  </Button>
                  <div
                    className="prompt-box__past-runs"
                    onClick={scrollToTasks}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") scrollToTasks();
                    }}
                  >
                    <Button
                      type="button"
                      variant="circle"
                      aria-label="View past runs"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToTasks();
                      }}
                    >
                      ↓
                    </Button>
                    <span className="type-label">VIEW PAST RUNS</span>
                  </div>
                </div>
                <span className="prompt-box__count">{prompt.length} CHARS</span>
              </div>
            </form>

            {/* Example chips */}
            <div className="home-hero__examples">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="example-chip"
                  onClick={() => setPrompt(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Trust statement */}
            <div className="home-hero__note">
              <span className="home-hero__note-star" aria-hidden="true">
                *
              </span>
              <span>
                Records that can't be traced to a source quote are dropped, never
                guessed.
              </span>
            </div>
          </div>

          {/* Right Cell: HeroArt */}
          <div className="grid-cell home-hero__art" aria-hidden="true">
            <HeroArt />
          </div>
        </div>

        {/* Row 3: Platform Stat Strip */}
        <StatStrip stats={statItems} />

        {/* Row 4: How it works */}
        <div id="how-it-works" className="grid-row how-it-works-row">
          <div className="grid-cell how-it-works__cell">
            <span className="how-it-works__step">01</span>
            <span className="how-it-works__title">UNDERSTAND</span>
            <p className="how-it-works__desc">
              Plain English prompt becomes a strict schema, key fields, and targets.
            </p>
          </div>
          <div className="grid-cell how-it-works__cell">
            <span className="how-it-works__step">02</span>
            <span className="how-it-works__title">COLLECT</span>
            <p className="how-it-works__desc">
              Search and fetch permitted public pages respecting robots.txt and policies.
            </p>
          </div>
          <div className="grid-cell how-it-works__cell">
            <span className="how-it-works__step">03</span>
            <span className="how-it-works__title">VERIFY</span>
            <p className="how-it-works__desc">
              Every candidate field must match an exact verbatim quote found on the page.
            </p>
          </div>
          <div className="grid-cell how-it-works__cell">
            <span className="how-it-works__step">04</span>
            <span className="how-it-works__title">CLEAN</span>
            <p className="how-it-works__desc">
              Normalize formats, run integrity validation, and deduplicate entities.
            </p>
          </div>
          <div className="grid-cell how-it-works__cell">
            <span className="how-it-works__step">05</span>
            <span className="how-it-works__title">EXPORT</span>
            <p className="how-it-works__desc">
              Export clean, audit-ready dataset as CSV, JSON, or Excel spreadsheet.
            </p>
          </div>
        </div>

        {/* Row 5: Policy row */}
        <div id="policy" className="grid-row policy-row">
          <div className="grid-cell policy__cell">
            <span className="policy__check">✓</span>
            <span>robots.txt respected</span>
          </div>
          <div className="grid-cell policy__cell">
            <span className="policy__check">✓</span>
            <span>No login-walled sites</span>
          </div>
          <div className="grid-cell policy__cell">
            <span className="policy__check">✓</span>
            <span>Private networks blocked</span>
          </div>
          <div className="grid-cell policy__cell">
            <span className="policy__check">✓</span>
            <span>Rate limited per domain</span>
          </div>
        </div>

        {/* Plan Review Panel (appears when preview data exists or loading) */}
        {previewMutation.isPending && (
          <div id="plan-review" className="plan-review">
            <StateBlock type="loading" message="PLANNING EXTRACTION…" />
          </div>
        )}

        {previewData && !previewMutation.isPending && (
          <div id="plan-review" className="plan-review">
            <div className="plan-review__header">
              <div className="plan-review__title-group">
                <h2 className="type-h2">
                  {previewData.spec.title || "Plan Review"}
                </h2>
                <span className="plan-review__entity">
                  [{previewData.spec.entity}] · Target: {previewData.spec.target_count} records
                </span>
              </div>
              <div className="plan-review__actions">
                <Button variant="ghost" onClick={scrollToPrompt}>
                  EDIT PROMPT
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createMutation.mutate()}
                  disabled={
                    Boolean(previewData.spec.clarification) ||
                    createMutation.isPending ||
                    !previewData.plan
                  }
                >
                  {createMutation.isPending ? "STARTING…" : "RUN TASK"}
                </Button>
              </div>
            </div>

            {previewData.spec.clarification && (
              <div className="plan-review__clarification">
                <span style={{ fontWeight: "bold" }}>CLARIFICATION REQUIRED:</span>
                <span>{previewData.spec.clarification}</span>
              </div>
            )}

            <div className="plan-review__grid">
              {/* Cell 1: Schema */}
              <div className="plan-review__cell">
                <span className="plan-review__cell-title">SCHEMA</span>
                <table className="plan-review__fields-table">
                  <thead>
                    <tr>
                      <th className="plan-review__fields-th">Field</th>
                      <th className="plan-review__fields-th">Type</th>
                      <th className="plan-review__fields-th">Req</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.spec.fields.map((f) => (
                      <tr key={f.name}>
                        <td className="plan-review__fields-td">
                          <code className="type-mono">{f.name}</code>
                        </td>
                        <td
                          className="plan-review__fields-td"
                          style={{ color: "var(--color-ink-muted)" }}
                        >
                          {f.type}
                        </td>
                        <td className="plan-review__fields-td">
                          {f.required ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cell 2: Plan */}
              <div className="plan-review__cell">
                <span className="plan-review__cell-title">PLAN</span>
                <div className="plan-review__steps">
                  {previewData.plan?.steps.map((st, i) => (
                    <div key={i}>
                      {String(i + 1).padStart(2, "0")}. {st.description}
                    </div>
                  ))}
                </div>
                {previewData.plan?.queries && (
                  <div className="plan-review__queries">
                    <span className="type-label" style={{ fontSize: "10px" }}>
                      SEARCH QUERIES
                    </span>
                    {previewData.plan.queries.map((q, i) => (
                      <div key={i} className="plan-review__query-tag">
                        "{q}"
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cell 3: Assumptions & Filters */}
              <div className="plan-review__cell">
                <span className="plan-review__cell-title">
                  ASSUMPTIONS AND FILTERS
                </span>
                <ul className="plan-review__assumptions">
                  {previewData.spec.assumptions.length === 0 ? (
                    <li className="type-small" style={{ color: "var(--color-ink-muted)" }}>
                      No special assumptions made.
                    </li>
                  ) : (
                    previewData.spec.assumptions.map((asmp, i) => (
                      <li key={i} className="plan-review__assumption-item">
                        <span className="plan-review__star">*</span>
                        {asmp}
                      </li>
                    ))
                  )}
                  {Object.entries(previewData.spec.filters || {}).map(([k, v]) => (
                    <li key={k} className="plan-review__assumption-item">
                      <span className="plan-review__star">*</span>
                      Filter: <strong>{k}</strong> = {v}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Row 6: Tasks List */}
        <section id="tasks" className="tasks-section" aria-label="Tasks List">
          <div className="tasks-section__header">
            <div className="tasks-section__title-group">
              <h2 className="type-h2">Your tasks</h2>
              <span className="tasks-section__count">({tasks.length})</span>
            </div>
          </div>

          {tasksLoading ? (
            <StateBlock type="loading" message="LOADING TASKS…" />
          ) : tasksError ? (
            <StateBlock
              type="error"
              message="Failed to load your tasks from server."
              onRetry={() => refetchTasks()}
            />
          ) : tasks.length === 0 ? (
            <StateBlock
              type="empty"
              message="No tasks yet. Describe the data you need above."
              actionLabel="TRY AN EXAMPLE"
              onAction={() => setPrompt(EXAMPLE_PROMPTS[0])}
            />
          ) : (
            <DataTable
              columns={taskColumns}
              data={tasks}
              rowKey={(t) => t.id}
              onRowClick={(t) => navigate(`/tasks/${t.id}`)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
