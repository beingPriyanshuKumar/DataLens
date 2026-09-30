import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "./Button";
import StatusPill from "./StatusPill";
import StatStrip, { type StatItem } from "./StatStrip";
import DataTable, { type Column } from "./DataTable";
import ConfidenceBar from "./ConfidenceBar";
import Drawer from "./Drawer";
import EventLog from "./EventLog";
import StateBlock from "./StateBlock";
import ReportPanel from "./ReportPanel";
import DiagnosticBanner from "./DiagnosticBanner";
import StageChecklist from "./StageChecklist";
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
import { safeHref } from "../utils/url";
import type { RecordDetail, RunStats, SourceDetail, TaskDetail } from "../types";
import "./TaskWorkspace.css";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

interface TaskWorkspaceProps {
  taskId: string;
  onStepChange?: (step: 3 | 4) => void;
}

export default function TaskWorkspace({ taskId, onStepChange }: TaskWorkspaceProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = searchParams.get("tab") || "results";
  const setTab = (newTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", newTab);
    setSearchParams(next);
  };

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [activeRunIdOverride, setActiveRunIdOverride] = useState<string | null>(null);
  const [completionNoticeDismissed, setCompletionNoticeDismissed] = useState(false);

  // Queries
  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
  });

  const latestRun = taskQuery.data?.runs?.[0];
  const activeRunId = activeRunIdOverride || latestRun?.id;
  const isTerminal = latestRun ? TERMINAL_STATUSES.has(latestRun.status) : false;
  const isActive = !!latestRun && !isTerminal;

  const runQuery = useQuery({
    queryKey: ["run", activeRunId],
    queryFn: () => getRun(activeRunId!),
    enabled: !!activeRunId,
    refetchInterval: isActive ? 1500 : false,
  });

  const handleRecordsUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["records", activeRunId] });
    queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  };

  const { events, isDone } = useRunEvents(activeRunId, isActive, handleRecordsUpdated);

  // Auto-advance step in Stepper
  useEffect(() => {
    if (onStepChange) {
      if (isActive || activeTab === "monitor") {
        onStepChange(3);
      } else {
        onStepChange(4);
      }
    }
  }, [isActive, activeTab, onStepChange]);

  // When active run completes with records, auto-advance to results tab
  useEffect(() => {
    if (isDone && !isActive && runQuery.data?.stats?.deduped_count && runQuery.data.stats.deduped_count > 0) {
      if (activeTab === "monitor") {
        setTab("results");
      }
    }
  }, [isDone, isActive, runQuery.data, activeTab]);

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
    enabled: !!activeRunId,
    refetchInterval: isActive ? 2000 : false,
  });

  const sourcesQuery = useQuery({
    queryKey: ["sources", activeRunId],
    queryFn: () => getSources(activeRunId!),
    enabled: !!activeRunId && activeTab === "sources",
  });

  const reportQuery = useQuery({
    queryKey: ["report", activeRunId],
    queryFn: () => getReport(activeRunId!),
    enabled: !!activeRunId && activeTab === "report",
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
    mutationFn: () => createRun(taskId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      setActiveRunIdOverride(data.run_id);
      setTab("monitor");
      setCompletionNoticeDismissed(false);
    },
  });

  const recordDetailQuery = useQuery({
    queryKey: ["record", selectedRecordId],
    queryFn: () => getRecord(selectedRecordId!),
    enabled: !!selectedRecordId,
  });

  if (taskQuery.isPending) {
    return <StateBlock type="loading" title="Loading task..." description="Fetching collection details." />;
  }

  if (taskQuery.isError) {
    return (
      <StateBlock
        type="error"
        title="Failed to load task"
        description={taskQuery.error.message}
        action={{ label: "RETRY", onClick: () => taskQuery.refetch() }}
      />
    );
  }

  const task = taskQuery.data;
  const currentRun = runQuery.data;
  const stats: RunStats = currentRun?.stats ?? latestRun?.stats ?? {};
  const currentStatus = currentRun?.status ?? latestRun?.status ?? "queued";
  const fields = task.spec.fields;
  const targetCount = task.spec.target_count || 30;
  const currentCount = stats.deduped_count ?? 0;
  const progressPct =
    currentStatus === "completed" ? 100 : Math.min(95, Math.round((currentCount / targetCount) * 100));

  // Funnel Stat Items
  const funnelStats: StatItem[] = [
    { id: "raw", value: stats.raw_count ?? 0, label: "Raw" },
    { id: "verified", value: stats.verified_count ?? 0, label: "Verified" },
    { id: "valid", value: stats.valid_count ?? 0, label: "Valid" },
    { id: "deduped", value: stats.deduped_count ?? 0, label: "Deduped", variant: "highlight" },
    { id: "blocked", value: stats.hallucinated_count ?? 0, label: "Blocked as unsupported", variant: "alert" },
  ];

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

  const sourceColumns: Column<SourceDetail>[] = [
    { key: "domain", label: "DOMAIN", isMono: true },
    {
      key: "url",
      label: "URL",
      render: (s) => {
        const safe = safeHref(s.url);
        return safe ? (
          <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline", color: "var(--color-ink)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="data-table__cell-truncate" title={s.url}>
              {s.url}
            </div>
          </a>
        ) : (
          <div className="data-table__cell-truncate" title={s.url}>
            {s.url}
          </div>
        );
      },
    },
    { key: "status", label: "STATUS", render: (s) => <StatusPill status={s.status} /> },
    { key: "http_status", label: "HTTP", isMono: true, render: (s) => <span>{s.http_status ?? "—"}</span> },
    {
      key: "reason",
      label: "REASON",
      render: (s) => (
        <div className="data-table__cell-truncate" title={s.reason || ""}>
          {s.reason || "—"}
        </div>
      ),
    },
    { key: "records_found", label: "RECORDS", isMono: true, render: (s) => <span>{s.records_found}</span> },
  ];

  const historyColumns: Column<NonNullable<TaskDetail["runs"]>[0]>[] = [
    { key: "id", label: "RUN", isMono: true, render: (r) => <span>{r.id.slice(0, 8)}…</span> },
    {
      key: "started_at",
      label: "STARTED (IST)",
      isMono: true,
      render: (r) => (
        <span>
          {r.started_at
            ? new Date(r.started_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
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
        const diffMs = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
        return <span>{Math.max(0, Math.round(diffMs / 1000))}s</span>;
      },
    },
    { key: "status", label: "STATUS", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "funnel",
      label: "RAW → DEDUPED",
      isMono: true,
      render: (r) => <span>{`${r.stats?.raw_count ?? 0} → ${r.stats?.deduped_count ?? 0}`}</span>,
    },
    {
      key: "actions",
      label: "ACTIONS",
      render: (r) => (
        <Button
          variant="ghost"
          size="small"
          onClick={() => {
            setActiveRunIdOverride(r.id);
            setTab("results");
          }}
        >
          VIEW ↗
        </Button>
      ),
    },
  ];

  return (
    <div className="task-workspace">
      {/* Task Summary Banner */}
      <div className="task-ws-header">
        <div className="task-ws-header__meta">
          <span className="task-ws-header__region font-mono">REGION: {task.spec.region || "GLOBAL"}</span>
          <h1 className="task-ws-header__title">{task.spec.title || "Collection Task"}</h1>
          <p className="task-ws-header__prompt">{task.prompt}</p>
        </div>
        <div className="task-ws-header__actions">
          <StatusPill status={currentStatus} />
          {isActive ? (
            <Button
              variant="danger"
              size="small"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "STOPPING…" : "CANCEL RUN"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="small"
              onClick={() => rerunMutation.mutate()}
              disabled={rerunMutation.isPending}
            >
              {rerunMutation.isPending ? "STARTING…" : "RE-RUN ↗"}
            </Button>
          )}
          <Button variant="ghost" size="small" onClick={() => navigate("/tasks")}>
            ← TASKS LOG
          </Button>
          <Button variant="primary" size="small" onClick={() => navigate("/collect")}>
            NEW TASK ↗
          </Button>
        </div>
      </div>

      {/* Completion Toast Banner */}
      {!completionNoticeDismissed && currentStatus === "completed" && (stats.deduped_count ?? 0) > 0 && (
        <div className="task-ws-notice">
          <span>
            Collection completed successfully! <strong>{stats.deduped_count} verified records</strong> produced.
          </span>
          <button className="task-ws-notice__close font-mono" onClick={() => setCompletionNoticeDismissed(true)}>
            ✕ DISMISS
          </button>
        </div>
      )}

      {/* Zero Results Diagnostic Warning */}
      {currentStatus === "completed" && (stats.deduped_count ?? 0) === 0 && (
        <DiagnosticBanner
          diagnostics={diagnosticsQuery.data || []}
          onActionClick={() => rerunMutation.mutate()}
        />
      )}

      {/* Tabs Row */}
      <div className="task-ws-tabs" role="tablist">
        <button
          className={`task-ws-tab ${activeTab === "monitor" ? "task-ws-tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "monitor"}
          onClick={() => setTab("monitor")}
        >
          03 / MONITOR {isActive && <span className="task-ws-tab__live-dot" />}
        </button>
        <button
          className={`task-ws-tab ${activeTab === "results" ? "task-ws-tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "results"}
          onClick={() => setTab("results")}
        >
          04 / RESULTS ({stats.deduped_count ?? 0})
        </button>
        <button
          className={`task-ws-tab ${activeTab === "sources" ? "task-ws-tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "sources"}
          onClick={() => setTab("sources")}
        >
          SOURCES ({sourcesQuery.data?.length ?? 0})
        </button>
        <button
          className={`task-ws-tab ${activeTab === "runs" ? "task-ws-tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "runs"}
          onClick={() => setTab("runs")}
        >
          RUNS ({task.runs?.length ?? 1})
        </button>
        <button
          className={`task-ws-tab ${activeTab === "report" ? "task-ws-tab--active" : ""}`}
          role="tab"
          aria-selected={activeTab === "report"}
          onClick={() => setTab("report")}
        >
          TRUST REPORT
        </button>
      </div>

      {/* TAB 1: MONITOR (Step 3) */}
      {activeTab === "monitor" && (
        <div className="task-ws-monitor">
          <StatStrip stats={funnelStats} />

          {/* Progress Bar */}
          <div className="task-ws-progress-bar-wrap">
            <div
              className="task-ws-progress-bar-fill"
              style={{ width: `${progressPct}%`, backgroundColor: isActive ? "var(--color-blue)" : "var(--color-ink)" }}
            />
          </div>

          <div className="task-ws-monitor-grid">
            {/* Left: Stage Checklist & Current URL */}
            <div className="task-ws-monitor-col">
              <StageChecklist events={events} status={currentStatus} stats={stats} />
              {/* Live first 5 rows preview if available */}
              {recordsQuery.data && recordsQuery.data.items.length > 0 && (
                <div className="task-ws-live-rows-panel">
                  <div className="task-ws-live-rows-head">
                    <span className="font-mono">LIVE EXTRACTED RECORDS (FIRST 5)</span>
                    <button className="task-ws-see-all-btn font-mono" onClick={() => setTab("results")}>
                      SEE ALL ({recordsQuery.data.total}) →
                    </button>
                  </div>
                  <div className="task-ws-live-list">
                    {recordsQuery.data.items.slice(0, 5).map((rec) => (
                      <div
                        key={rec.id}
                        className="task-ws-live-item"
                        onClick={() => {
                          setSelectedRecordId(rec.id);
                          setTab("results");
                        }}
                      >
                        <span className="task-ws-live-title">
                          {String(Object.values(rec.data)[0] || "Record")}
                        </span>
                        <ConfidenceBar value={rec.confidence} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live Event Log */}
            <div className="task-ws-monitor-col">
              <EventLog events={events} isLive={isActive} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESULTS (Step 4) */}
      {activeTab === "results" && (
        <div className="task-ws-results">
          {/* Results Toolbar */}
          <div className="task-ws-results-toolbar">
            <div className="task-ws-search-box">
              <input
                type="text"
                placeholder="Search extracted records..."
                className="task-ws-filter-input font-mono"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="task-ws-conf-box">
              <label className="task-ws-conf-label font-mono">
                CONF: {minConfidence > 0 ? `≥${minConfidence}%` : "ALL"}
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="10"
                value={minConfidence}
                onChange={(e) => {
                  setMinConfidence(Number(e.target.value));
                  setPage(1);
                }}
              />
            </div>
            <div className="task-ws-export-box">
              <button
                className="task-ws-export-btn font-mono"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={!activeRunId || (stats.deduped_count ?? 0) === 0}
              >
                EXPORT ▾
              </button>
              {exportOpen && activeRunId && (
                <div className="task-ws-export-menu">
                  <a
                    href={getExportUrl(activeRunId, "csv")}
                    download
                    className="task-ws-export-item font-mono"
                    onClick={() => setExportOpen(false)}
                  >
                    CSV (.csv)
                  </a>
                  <a
                    href={getExportUrl(activeRunId, "xlsx")}
                    download
                    className="task-ws-export-item font-mono"
                    onClick={() => setExportOpen(false)}
                  >
                    Excel (.xlsx)
                  </a>
                  <a
                    href={getExportUrl(activeRunId, "json")}
                    download
                    className="task-ws-export-item font-mono"
                    onClick={() => setExportOpen(false)}
                  >
                    JSON (.json)
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Records Data Table */}
          {recordsQuery.isLoading ? (
            <StateBlock type="loading" title="Loading records..." description="Streaming dataset from local database." />
          ) : recordsQuery.data?.items.length === 0 ? (
            <StateBlock
              type="empty"
              title="No records found"
              description={
                searchQuery || minConfidence > 0
                  ? "Try loosening search or confidence filters."
                  : "No records were extracted for this task."
              }
            />
          ) : (
            <div className="task-ws-table-container">
              <DataTable<RecordDetail>
                columns={resultColumns}
                data={recordsQuery.data?.items ?? []}
                rowKey={(r) => r.id}
                onRowClick={(r) => setSelectedRecordId(r.id)}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSort={(k) => {
                  if (sortColumn === k) {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortColumn(k);
                    setSortOrder("asc");
                  }
                  setPage(1);
                }}
              />
              {/* Pagination */}
              {recordsQuery.data && recordsQuery.data.total_pages > 1 && (
                <div className="task-ws-pagination">
                  <span className="font-mono">
                    PAGE {page} OF {recordsQuery.data.total_pages} ({recordsQuery.data.total} records)
                  </span>
                  <div className="task-ws-pagination-btns">
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ← PREV
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      disabled={page >= recordsQuery.data.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      NEXT →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evidence Drawer */}
          {selectedRecordId && (
            <Drawer
              isOpen={!!selectedRecordId}
              onClose={() => setSelectedRecordId(null)}
              record={
                recordDetailQuery.data?.record ??
                recordsQuery.data?.items?.find((r) => r.id === selectedRecordId) ??
                null
              }
              evidence={recordDetailQuery.data?.evidence ?? []}
              titleField={fields[0]?.name}
            />
          )}
        </div>
      )}

      {/* TAB 3: SOURCES */}
      {activeTab === "sources" && (
        <div className="task-ws-sources">
          <div className="task-ws-source-filters">
            {["ALL", "FETCHED", "BLOCKED", "FAILED"].map((f) => (
              <button
                key={f}
                className={`task-ws-source-fbtn ${sourceFilter === f ? "task-ws-source-fbtn--active" : ""}`}
                onClick={() => setSourceFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <DataTable<SourceDetail>
            columns={sourceColumns}
            data={(sourcesQuery.data ?? []).filter((s) => {
              if (sourceFilter === "FETCHED") return s.status === "fetched";
              if (sourceFilter === "BLOCKED") return s.status.includes("blocked");
              if (sourceFilter === "FAILED") return s.status === "failed";
              return true;
            })}
            rowKey={(s, i) => `${s.url}-${i}`}
          />
        </div>
      )}

      {/* TAB 4: RUNS */}
      {activeTab === "runs" && (
        <div className="task-ws-history">
          <DataTable<NonNullable<TaskDetail["runs"]>[0]>
            columns={historyColumns}
            data={task.runs ?? []}
            rowKey={(r) => r.id}
          />
        </div>
      )}

      {/* TAB 5: REPORT */}
      {activeTab === "report" && (
        <div className="task-ws-report">
          {reportQuery.isLoading ? (
            <StateBlock type="loading" title="Generating audit report..." description="Compiling provenance statistics." />
          ) : reportQuery.data ? (
            <ReportPanel report={reportQuery.data} />
          ) : (
            <StateBlock type="empty" title="Report unavailable" description="Run did not generate an audit report." />
          )}
        </div>
      )}
    </div>
  );
}
