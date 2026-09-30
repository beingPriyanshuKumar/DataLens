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
import TemplateModal from "../components/TemplateModal";
import PlanEditor from "../components/PlanEditor";
import { HINGLISH_EXAMPLE } from "../templates";
import { listTasks, previewTask, createTask, deleteTask, createRun, getPlatformStats, getSystemDiagnostics } from "../api";
import type { SystemDiagnostics } from "../api";
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isCustomizingPlan, setIsCustomizingPlan] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
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

  const { data: sysDiag } = useQuery<SystemDiagnostics>({
    queryKey: ["system-diagnostics"],
    queryFn: getSystemDiagnostics,
    refetchInterval: 60000,
    retry: 1,
  });

  const llmOk = sysDiag?.llm?.ok !== false;
  const searchFallback = sysDiag?.search?.provider === "ddg" && sysDiag?.search?.ok;
  const [dismissedSearchBanner, setDismissedSearchBanner] = useState(() => {
    try {
      return localStorage.getItem("datalens_dismiss_ddg_notice") === "true";
    } catch {
      return false;
    }
  });

  const handleDismissSearchBanner = () => {
    setDismissedSearchBanner(true);
    try {
      localStorage.setItem("datalens_dismiss_ddg_notice", "true");
    } catch {
      // ignore
    }
  };

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

        {/* Diagnostics Banners */}
        {sysDiag && !llmOk && (
          <div style={{
            background: "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)",
            color: "#fff",
            padding: "14px 24px",
            borderRadius: "8px",
            margin: "0 24px 12px",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <span style={{ fontSize: "18px" }}>⚠</span>
            <span>
              No working LLM configured. Set{" "}
              <code style={{ background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: "4px" }}>
                {sysDiag.llm?.provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"}
              </code>{" "}
              in <code style={{ background: "rgba(255,255,255,0.2)", padding: "2px 6px", borderRadius: "4px" }}>backend/.env</code>, then restart the backend.
            </span>
          </div>
        )}
        {/* Search Failure Banner */}
        {sysDiag?.search && sysDiag.search.ok === false && (
          <div style={{
            background: "linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)",
            color: "#fff",
            padding: "10px 24px",
            borderRadius: "8px",
            margin: "0 24px 12px",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <span style={{ fontSize: "16px" }}>⚠</span>
            <span>Search error ({sysDiag.search.provider}): {sysDiag.search.error || "Search is currently unavailable."}</span>
          </div>
        )}

        {/* Informational Keyless DDG Notice (Dismissable) */}
        {searchFallback && !dismissedSearchBanner && sysDiag?.search?.ok && (
          <div style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            color: "#92400e",
            padding: "8px 20px",
            borderRadius: "8px",
            margin: "0 24px 12px",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>ℹ</span>
              <span>Search is running via keyless DuckDuckGo. For higher volume searches, you can optionally configure a Tavily API key in <code>backend/.env</code>.</span>
            </div>
            <button
              type="button"
              onClick={handleDismissSearchBanner}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#92400e",
                fontWeight: "bold",
                fontSize: "14px",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
              aria-label="Dismiss search notice"
            >
              ✕
            </button>
          </div>
        )}

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
                    disabled={!prompt.trim() || previewMutation.isPending || !llmOk}
                  >
                    {previewMutation.isPending ? "PLANNING…" : "PREVIEW PLAN"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsTemplateModalOpen(true)}
                  >
                    BROWSE TEMPLATES ↗
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
              {previewMutation.isError && (
                <div style={{
                  padding: "10px 16px",
                  marginTop: "12px",
                  borderRadius: "6px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span>⚠ {previewMutation.error instanceof Error ? previewMutation.error.message : "Failed to generate plan. Please try again."}</span>
                  <button
                    type="button"
                    onClick={() => previewMutation.reset()}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: "bold" }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </form>

            {/* Example chips */}
            <div className="home-hero__examples">
              <button
                type="button"
                className="example-chip"
                style={{ borderColor: "var(--color-accent, #2563eb)", color: "var(--color-accent, #2563eb)" }}
                onClick={() => setPrompt(HINGLISH_EXAMPLE.prompt)}
              >
                ✨ Hinglish: ML jobs 20 LPA
              </button>
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
                {previewData.plan && (
                  <Button
                    variant="secondary"
                    onClick={() => setIsCustomizingPlan(!isCustomizingPlan)}
                  >
                    {isCustomizingPlan ? "STANDARD VIEW" : "CUSTOMIZE PLAN & ESTIMATE ⚙"}
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => createMutation.mutate()}
                  disabled={
                    Boolean(previewData.spec.clarification) ||
                    createMutation.isPending ||
                    !previewData.plan ||
                    !llmOk
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

            {isCustomizingPlan && previewData.plan ? (
              <PlanEditor
                spec={previewData.spec}
                plan={previewData.plan}
                onSpecChange={(spec) => setPreviewData({ ...previewData, spec })}
                onPlanChange={(plan) => setPreviewData({ ...previewData, plan })}
              />
            ) : (
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
            )}
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

        {/* Template Browser Modal */}
        <TemplateModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          onSelectPrompt={(selected) => setPrompt(selected)}
        />
      </div>
    </div>
  );
}
