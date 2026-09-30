import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "../components/Header";
import Button from "../components/Button";
import StatusPill from "../components/StatusPill";
import StatStrip, { type StatItem } from "../components/StatStrip";
import Tabs, { type TabItem } from "../components/Tabs";
import DataTable, { type Column } from "../components/DataTable";
import ConfidenceBar from "../components/ConfidenceBar";
import Drawer from "../components/Drawer";
import EventLog from "../components/EventLog";
import StateBlock from "../components/StateBlock";
import ReportPanel from "../components/ReportPanel";
import DiagnosticBanner from "../components/DiagnosticBanner";
import StageChecklist from "../components/StageChecklist";
import {
  getTask,
  getRun,
  getRecords,
  getRecord,
  getSources,
  getReport,
  getDiagnostics,
  cancelRun,
  createRun,
  getExportUrl,
} from "../api";
import { useRunEvents } from "../hooks/useRunEvents";
import type {
  RecordDetail,
  RunStats,
  SourceDetail,
} from "../types";
import "./TaskDetail.css";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

const TABS: TabItem[] = [
  { id: "progress", label: "PROGRESS" },
  { id: "results", label: "RESULTS" },
  { id: "sources", label: "SOURCES" },
  { id: "report", label: "REPORT" },
  { id: "history", label: "HISTORY" },
];

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const tab = searchParams.get("tab") || "progress";
  const setTab = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  // State
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [activeRunIdOverride, setActiveRunIdOverride] = useState<string | null>(null);

  // Queries
  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  });

  const latestRun = taskQuery.data?.runs?.[0];
  const activeRunId = activeRunIdOverride || latestRun?.id;
  const isActive = !!latestRun && !TERMINAL_STATUSES.has(latestRun.status);

  const runQuery = useQuery({
    queryKey: ["run", activeRunId],
    queryFn: () => getRun(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: isActive ? 2000 : false,
  });

  const handleRecordsUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["records", activeRunId] });
    queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  };

  const { events, isDone } = useRunEvents(activeRunId, isActive, handleRecordsUpdated);

  useEffect(() => {
    if (!isActive && activeRunId) {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
      queryClient.invalidateQueries({ queryKey: ["diagnostics", activeRunId] });
    }
  }, [isActive, activeRunId, taskId, queryClient]);

  const recordsQuery = useQuery({
    queryKey: ["records", activeRunId, page, searchQuery, minConfidence, sortColumn, sortOrder],
    queryFn: () =>
      getRecords(activeRunId!, {
        page,
        page_size: 20,
        q: searchQuery || undefined,
        min_confidence: minConfidence > 0 ? minConfidence : undefined,
        sort: sortColumn,
        order: sortOrder,
      }),
    enabled: !!activeRunId && tab === "results",
    refetchInterval: isActive ? 2000 : false,
  });

  const sourcesQuery = useQuery({
    queryKey: ["sources", activeRunId],
    queryFn: () => getSources(activeRunId!),
    enabled: !!activeRunId && tab === "sources",
  });

  const reportQuery = useQuery({
    queryKey: ["report", activeRunId],
    queryFn: () => getReport(activeRunId!),
    enabled: !!activeRunId && tab === "report",
  });

  const diagnosticsQuery = useQuery({
    queryKey: ["diagnostics", activeRunId],
    queryFn: () => getDiagnostics(activeRunId!),
    enabled: !!activeRunId,
  });

  // Mutations
  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(activeRunId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => createRun(taskId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      setActiveRunIdOverride(data.run_id);
      setTab("progress");
    },
  });

  const drawerParam = searchParams.get("drawer") === "open";
  const effectiveRecordId =
    selectedRecordId ?? (drawerParam ? recordsQuery.data?.items?.[0]?.id ?? null : null);

  const recordDetailQuery = useQuery({
    queryKey: ["record", effectiveRecordId],
    queryFn: () => getRecord(effectiveRecordId!),
    enabled: !!effectiveRecordId,
  });

  const handleRecordClick = (rec: RecordDetail) => {
    setSelectedRecordId(rec.id);
  };

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortOrder("asc");
    }
    setPage(1);
  };

  if (taskQuery.isPending) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <Header />
          <StateBlock type="loading" message="LOADING TASK…" />
        </div>
      </div>
    );
  }

  if (taskQuery.isError) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <Header />
          <StateBlock
            type="error"
            message={`Failed to load task: ${taskQuery.error.message}`}
            onRetry={() => taskQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const task = taskQuery.data;
  const currentRun = runQuery.data;
  const stats: RunStats = currentRun?.stats ?? latestRun?.stats ?? {};
  const currentStatus = currentRun?.status ?? latestRun?.status ?? "queued";
  const fields = task.spec.fields;

  // Funnel Stat Items
  const funnelStats: StatItem[] = [
    {
      id: "raw",
      value: stats.raw_count ?? 0,
      label: "Raw",
    },
    {
      id: "verified",
      value: stats.verified_count ?? 0,
      label: "Verified",
    },
    {
      id: "valid",
      value: stats.valid_count ?? 0,
      label: "Valid",
    },
    {
      id: "deduped",
      value: stats.deduped_count ?? 0,
      label: "Deduped",
      variant: "highlight",
    },
    {
      id: "blocked",
      value: stats.hallucinated_count ?? 0,
      label: "Blocked as unsupported",
      variant: "alert",
    },
  ];

  // Progress Bar calculation
  const targetCount = task.spec.target_count || 30;
  const currentCount = stats.deduped_count ?? 0;
  const progressPct =
    currentStatus === "completed"
      ? 100
      : Math.min(95, Math.round((currentCount / targetCount) * 100));

  // Dynamic Table Columns for Results
  const resultColumns: Column<RecordDetail>[] = [
    ...fields.map((f) => ({
      key: f.name,
      label: f.name.replace(/_/g, " "),
      sortable: true,
      render: (r: RecordDetail) => {
        const val = r.data[f.name];
        return (
          <div className="data-table__cell-truncate" title={val != null ? String(val) : ""}>
            {val != null ? String(val) : "—"}
          </div>
        );
      },
    })),
    {
      key: "confidence",
      label: "CONFIDENCE",
      sortable: true,
      render: (r: RecordDetail) => <ConfidenceBar value={r.confidence} />,
    },
  ];

  // Filtered Sources
  const filteredSources = (sourcesQuery.data ?? []).filter((s) => {
    if (sourceFilter === "FETCHED") return s.status === "fetched";
    if (sourceFilter === "BLOCKED") return s.status.includes("blocked");
    if (sourceFilter === "FAILED") return s.status === "failed";
    return true;
  });

  const sourceColumns: Column<SourceDetail>[] = [
    {
      key: "domain",
      label: "DOMAIN",
      isMono: true,
    },
    {
      key: "url",
      label: "URL",
      render: (s) => (
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline", color: "var(--color-ink)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="data-table__cell-truncate" title={s.url}>
            {s.url}
          </div>
        </a>
      ),
    },
    {
      key: "status",
      label: "STATUS",
      render: (s) => <StatusPill status={s.status} />,
    },
    {
      key: "http_status",
      label: "HTTP",
      isMono: true,
      render: (s) => <span>{s.http_status ?? "—"}</span>,
    },
    {
      key: "reason",
      label: "REASON",
      render: (s) => (
        <div className="data-table__cell-truncate" title={s.reason || ""}>
          {s.reason || "—"}
        </div>
      ),
    },
    {
      key: "records_found",
      label: "RECORDS",
      isMono: true,
      render: (s) => <span>{s.records_found}</span>,
    },
  ];

  // History Columns
  const historyColumns: Column<typeof task.runs[0]>[] = [
    {
      key: "id",
      label: "RUN",
      isMono: true,
      render: (r) => <span>{r.id.slice(0, 8)}…</span>,
    },
    {
      key: "started_at",
      label: "STARTED",
      isMono: true,
      render: (r) => (
        <span>
          {r.started_at
            ? new Date(r.started_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "duration",
      label: "DURATION",
      isMono: true,
      render: (r) => {
        if (!r.started_at || !r.finished_at) return <span>—</span>;
        const diffMs =
          new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
        const sec = Math.max(0, Math.round(diffMs / 1000));
        return <span>{sec}s</span>;
      },
    },
    {
      key: "status",
      label: "STATUS",
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "funnel",
      label: "RAW → DEDUPED",
      isMono: true,
      render: (r) => {
        const raw = r.stats?.raw_count ?? 0;
        const deduped = r.stats?.deduped_count ?? 0;
        return <span>{`${raw} → ${deduped}`}</span>;
      },
    },
    {
      key: "actions",
      label: "ACTIONS",
      render: (r) => (
        <Button
          variant="ghost"
          onClick={() => {
            setActiveRunIdOverride(r.id);
            setTab("results");
          }}
          aria-label={`Open run ${r.id.slice(0, 8)}`}
        >
          OPEN ↗
        </Button>
      ),
    },
  ];

  return (
    <div className="app-viewport">
      <div className="app-frame">
        {/* Row 1: Header */}
        <Header />

        {/* Row 2: Title Row */}
        <div className="task-title-row">
          <div className="task-title-row__header">
            <div>
              <h1 className="task-title-row__title">
                {task.spec.title || "Task Details"}
              </h1>
            </div>
            <div className="task-title-row__actions">
              <StatusPill status={currentStatus} />
              {currentStatus === "running" || currentStatus === "queued" ? (
                <Button
                  variant="danger"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? "CANCELLING…" : "CANCEL RUN"}
                </Button>
              ) : currentStatus === "cancelling" ? (
                <Button variant="danger" disabled>
                  CANCELLING…
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => rerunMutation.mutate()}
                  disabled={rerunMutation.isPending}
                >
                  {rerunMutation.isPending ? "STARTING…" : "RE-RUN"}
                </Button>
              )}
            </div>
          </div>

          <div
            className="task-title-row__prompt-wrapper"
            onClick={() => setIsPromptExpanded(!isPromptExpanded)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setIsPromptExpanded(!isPromptExpanded);
              }
            }}
          >
            <p
              className={`task-title-row__prompt ${
                isPromptExpanded ? "" : "task-title-row__prompt--clamped"
              }`}
            >
              {task.prompt}
            </p>
            <span className="task-title-row__prompt-toggle">
              {isPromptExpanded ? "Show less ↑" : "Show full prompt ↓"}
            </span>
          </div>
        </div>

        {/* Row 3: Tabs */}
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />

        {/* Tab 1: PROGRESS */}
        {tab === "progress" && (
          <div className="progress-tab" id="panel-progress" role="tabpanel">
            <StatStrip stats={funnelStats} ariaLive="polite" />
            <div className="progress-bar-row">
              <div
                className="progress-bar-row__fill"
                style={{ "--progress": `${progressPct}%` } as CSSProperties}
              />
            </div>

            {/* Stage Checklist with Live "Now Reading" state */}
            <StageChecklist
              status={currentStatus}
              stats={stats}
              events={events}
            />

            {/* Zero-result / diagnostic banner */}
            <DiagnosticBanner
              diagnostics={diagnosticsQuery.data || []}
              onActionClick={(action) => {
                if (action.toLowerCase().includes("report")) setTab("report");
                else if (action.toLowerCase().includes("seed") || action.toLowerCase().includes("sources")) setTab("sources");
              }}
            />

            {currentStatus === "cancelling" && (
              <div className="progress-tab__cancelling">
                Cancelling after the current page finishes…
              </div>
            )}

            {currentRun?.error && (
              <div className="progress-tab__error">
                <strong>Error:</strong> {currentRun.error}
              </div>
            )}

            <EventLog events={events} isLive={isActive && !isDone} />
          </div>
        )}

        {/* Tab 2: RESULTS */}
        {tab === "results" && (
          <div className="results-tab" id="panel-results" role="tabpanel">
            {/* Diagnostics notice on results if low yield */}
            <DiagnosticBanner
              diagnostics={diagnosticsQuery.data || []}
              onActionClick={(action) => {
                if (action.toLowerCase().includes("report")) setTab("report");
                else if (action.toLowerCase().includes("seed") || action.toLowerCase().includes("sources")) setTab("sources");
              }}
            />

            <div className="results-toolbar">
              <div className="results-toolbar__left">
                <div className="results-search">
                  <input
                    type="text"
                    className="results-search__input"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <div className="confidence-slider">
                  <label className="confidence-slider__label">
                    MIN CONFIDENCE:
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={minConfidence}
                    className="confidence-slider__input"
                    onChange={(e) => {
                      setMinConfidence(Number(e.target.value));
                      setPage(1);
                    }}
                  />
                  <span className="confidence-slider__val">
                    {minConfidence.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="results-toolbar__right">
                {isActive && (
                  <span
                    className="provisional-badge"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--color-accent, #2563eb)",
                      backgroundColor: "rgba(37, 99, 235, 0.1)",
                      border: "1px solid rgba(37, 99, 235, 0.3)",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                    }}
                  >
                    LIVE · PROVISIONAL
                  </span>
                )}

                <span className="results-count">
                  {recordsQuery.data ? `${recordsQuery.data.total} RECORDS` : ""}
                </span>

                {activeRunId && (
                  <div className="export-menu-wrapper">
                    <Button
                      variant="secondary"
                      onClick={() => setExportOpen(!exportOpen)}
                      aria-haspopup="true"
                      aria-expanded={exportOpen}
                    >
                      EXPORT ↓
                    </Button>
                    {exportOpen && (
                      <div className="export-menu">
                        {(["csv", "json", "xlsx"] as const).map((fmt) => (
                          <a
                            key={fmt}
                            href={getExportUrl(activeRunId, fmt)}
                            className="export-menu__item"
                            onClick={() => setExportOpen(false)}
                          >
                            {fmt.toUpperCase()}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {recordsQuery.isPending ? (
              <StateBlock type="loading" message="LOADING RECORDS…" />
            ) : recordsQuery.isError ? (
              <StateBlock
                type="error"
                message={`Failed to load records: ${recordsQuery.error.message}`}
                onRetry={() => recordsQuery.refetch()}
              />
            ) : recordsQuery.data.items.length === 0 ? (
              <StateBlock
                type="empty"
                message="No records found. Filters might be too strict or permitted sources blocked."
                actionLabel="VIEW SOURCES"
                onAction={() => setTab("sources")}
              />
            ) : (
              <>
                <DataTable
                  columns={resultColumns}
                  data={recordsQuery.data.items}
                  rowKey={(r) => r.id}
                  sortColumn={sortColumn}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onRowClick={handleRecordClick}
                />

                <div className="table-pagination">
                  <span className="table-pagination__info">
                    PAGE {recordsQuery.data.page} OF {recordsQuery.data.total_pages || 1}
                  </span>
                  <div className="table-pagination__actions">
                    <Button
                      variant="ghost"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      PREV
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={page >= recordsQuery.data.total_pages}
                      onClick={() => setPage(page + 1)}
                    >
                      NEXT
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: SOURCES */}
        {tab === "sources" && (
          <div className="sources-tab" id="panel-sources" role="tabpanel">
            <div className="sources-toolbar">
              {(["ALL", "FETCHED", "BLOCKED", "FAILED"] as const).map((filter) => (
                <button
                  key={filter}
                  className={`sources-filter-btn ${
                    sourceFilter === filter ? "sources-filter-btn--active" : ""
                  }`}
                  onClick={() => setSourceFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>

            {sourcesQuery.isPending ? (
              <StateBlock type="loading" message="LOADING SOURCES…" />
            ) : sourcesQuery.isError ? (
              <StateBlock
                type="error"
                message={`Failed to load sources: ${sourcesQuery.error.message}`}
                onRetry={() => sourcesQuery.refetch()}
              />
            ) : filteredSources.length === 0 ? (
              <StateBlock
                type="empty"
                message={`No sources found for filter "${sourceFilter}".`}
              />
            ) : (
              <DataTable
                columns={sourceColumns}
                data={filteredSources}
                rowKey={(s) => s.id}
              />
            )}
          </div>
        )}

        {/* Tab 4: REPORT */}
        {tab === "report" && (
          <div className="report-tab" id="panel-report" role="tabpanel">
            {reportQuery.isPending ? (
              <StateBlock type="loading" message="COMPUTING TRUST REPORT…" />
            ) : reportQuery.isError ? (
              <StateBlock
                type="error"
                message={`Failed to generate report: ${reportQuery.error.message}`}
                onRetry={() => reportQuery.refetch()}
              />
            ) : reportQuery.data ? (
              <ReportPanel report={reportQuery.data} fields={fields} />
            ) : (
              <StateBlock
                type="empty"
                message="No report data available yet for this run."
              />
            )}
          </div>
        )}

        {/* Tab 5: HISTORY */}
        {tab === "history" && (
          <div className="history-tab" id="panel-history" role="tabpanel">
            <div className="history-toolbar">
              <Button
                variant="primary"
                onClick={() => rerunMutation.mutate()}
                disabled={rerunMutation.isPending}
              >
                {rerunMutation.isPending ? "STARTING…" : "RE-RUN"}
              </Button>
            </div>

            {task.runs.length === 0 ? (
              <StateBlock
                type="empty"
                message="No runs recorded yet for this task."
              />
            ) : (
              <DataTable
                columns={historyColumns}
                data={task.runs}
                rowKey={(r) => r.id}
              />
            )}
          </div>
        )}

        {/* Record Evidence Drawer */}
        <Drawer
          isOpen={Boolean(effectiveRecordId && recordDetailQuery.data)}
          onClose={() => {
            setSelectedRecordId(null);
            if (drawerParam) {
              const next = new URLSearchParams(searchParams);
              next.delete("drawer");
              setSearchParams(next);
            }
          }}
          record={recordDetailQuery.data?.record ?? null}
          evidence={recordDetailQuery.data?.evidence ?? []}
          titleField={fields[0]?.name}
        />
      </div>
    </div>
  );
}
