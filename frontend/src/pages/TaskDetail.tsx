import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Play,
  Square,
  Download,
  ExternalLink,
  Database,
  Globe,
  History,
  Activity,
  ChevronDown,
  X,
} from "lucide-react";
import {
  getTask,
  getRun,
  getRecords,
  getRecord,
  getSources,
  cancelRun,
  createRun,
  getExportUrl,
} from "../api";
import { useRunEvents } from "../hooks/useRunEvents";
import type {
  RecordDetail,
  RecordWithEvidence,
  RunStats,
  SourceDetail,
} from "../types";
import StatusBadge from "../components/StatusBadge";
import ConfidenceBar from "../components/ConfidenceBar";
import { Spinner, EmptyState, ErrorState } from "../components/Shared";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

type Tab = "progress" | "results" | "sources" | "history";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("progress");
  const [selectedRecord, setSelectedRecord] = useState<RecordWithEvidence | null>(null);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [exportOpen, setExportOpen] = useState(false);

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  });

  const latestRun = taskQuery.data?.runs?.[0];
  const latestRunId = latestRun?.id;
  const isActive = !!latestRun && !TERMINAL.has(latestRun.status);

  const runQuery = useQuery({
    queryKey: ["run", latestRunId],
    queryFn: () => getRun(latestRunId!),
    enabled: !!latestRunId,
    refetchInterval: isActive ? 2000 : false,
  });

  const { events } = useRunEvents(latestRunId, isActive);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  useEffect(() => {
    if (!isActive && latestRunId) {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["run", latestRunId] });
    }
  }, [isActive, latestRunId, taskId, queryClient]);

  const recordsQuery = useQuery({
    queryKey: ["records", latestRunId, page, searchQuery, minConfidence],
    queryFn: () =>
      getRecords(latestRunId!, {
        page,
        page_size: 20,
        q: searchQuery || undefined,
        min_confidence: minConfidence > 0 ? minConfidence : undefined,
      }),
    enabled: !!latestRunId && tab === "results",
  });

  const sourcesQuery = useQuery({
    queryKey: ["sources", latestRunId],
    queryFn: () => getSources(latestRunId!),
    enabled: !!latestRunId && tab === "sources",
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(latestRunId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", latestRunId] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => createRun(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      setTab("progress");
    },
  });

  const handleRecordClick = async (record: RecordDetail) => {
    const detail = await getRecord(record.id);
    setSelectedRecord(detail);
  };

  if (taskQuery.isPending) return <div className="page-center"><Spinner size={32} /></div>;
  if (taskQuery.isError) return <div className="page-center"><ErrorState message={taskQuery.error.message} /></div>;

  const task = taskQuery.data;
  const run = runQuery.data;
  const stats: RunStats = run?.stats ?? {};
  const fields = task.spec.fields;

  return (
    <div className="task-detail">
      <div className="task-detail__header">
        <button className="btn btn--ghost" onClick={() => navigate("/")}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="task-detail__title-row">
          <h1>{task.spec.title}</h1>
          {run && <StatusBadge status={run.status} />}
        </div>
        <p className="task-detail__prompt">{task.prompt}</p>
        <div className="task-detail__actions">
          {isActive && (
            <button className="btn btn--danger" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              <Square size={14} /> Cancel
            </button>
          )}
          {!isActive && (
            <button className="btn btn--primary" onClick={() => rerunMutation.mutate()} disabled={rerunMutation.isPending}>
              <Play size={14} /> Re-run
            </button>
          )}
          {!isActive && latestRunId && (
            <div className="export-dropdown">
              <button className="btn btn--outline" onClick={() => setExportOpen(!exportOpen)}>
                <Download size={14} /> Export <ChevronDown size={12} />
              </button>
              {exportOpen && (
                <div className="export-dropdown__menu">
                  {(["csv", "json", "xlsx"] as const).map((fmt) => (
                    <a
                      key={fmt}
                      href={getExportUrl(latestRunId, fmt)}
                      className="export-dropdown__item"
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

      <nav className="tabs">
        {(["progress", "results", "sources", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tabs__tab ${tab === t ? "tabs__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "progress" && <Activity size={14} />}
            {t === "results" && <Database size={14} />}
            {t === "sources" && <Globe size={14} />}
            {t === "history" && <History size={14} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === "progress" && (
          <ProgressTab stats={stats} events={events} logEndRef={logEndRef} isActive={isActive} run={run} />
        )}
        {tab === "results" && (
          <ResultsTab
            recordsQuery={recordsQuery}
            fields={fields}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            minConfidence={minConfidence}
            setMinConfidence={setMinConfidence}
            page={page}
            setPage={setPage}
            onRecordClick={handleRecordClick}
          />
        )}
        {tab === "sources" && <SourcesTab sourcesQuery={sourcesQuery} />}
        {tab === "history" && <HistoryTab runs={task.runs} />}
      </div>

      {selectedRecord && (
        <RecordDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
    </div>
  );
}

function ProgressTab({
  stats,
  events,
  logEndRef,
  isActive,
  run,
}: {
  stats: RunStats;
  events: { level: string; step: string; message: string; created_at: string }[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  run: { status: string; error?: string | null } | undefined;
}) {
  const funnel = [
    { label: "Raw", value: stats.raw_count ?? 0 },
    { label: "Verified", value: stats.verified_count ?? 0 },
    { label: "Valid", value: stats.valid_count ?? 0 },
    { label: "Final", value: stats.deduped_count ?? 0 },
  ];
  const maxVal = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="progress-tab">
      <div className="funnel">
        <h3>Data Funnel</h3>
        <div className="funnel__bars">
          {funnel.map((f) => (
            <div key={f.label} className="funnel__item">
              <span className="funnel__label">{f.label}</span>
              <div className="funnel__bar-track">
                <div
                  className="funnel__bar-fill"
                  style={{ width: `${(f.value / maxVal) * 100}%` }}
                />
              </div>
              <span className="funnel__value">{f.value}</span>
            </div>
          ))}
        </div>
        <div className="funnel__meta">
          <span>📄 Pages fetched: {stats.pages_fetched ?? 0}</span>
          <span>❌ Pages failed: {stats.pages_failed ?? 0}</span>
          <span>🚫 Hallucinated dropped: {stats.hallucinated_count ?? 0}</span>
        </div>
      </div>

      {run?.error && (
        <div className="error-banner">
          <strong>Error:</strong> {run.error}
        </div>
      )}

      <div className="event-log">
        <h3>
          Live Log
          {isActive && <span className="event-log__live-dot" />}
        </h3>
        <div className="event-log__entries">
          {events.map((e, i) => (
            <div key={i} className={`event-log__entry event-log__entry--${e.level}`}>
              <span className="event-log__time">
                {new Date(e.created_at).toLocaleTimeString()}
              </span>
              <span className="event-log__step">{e.step}</span>
              <span className="event-log__msg">{e.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

function ResultsTab({
  recordsQuery,
  fields,
  searchQuery,
  setSearchQuery,
  minConfidence,
  setMinConfidence,
  page,
  setPage,
  onRecordClick,
}: {
  recordsQuery: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getRecords>>>>;
  fields: { name: string; type: string }[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  minConfidence: number;
  setMinConfidence: (v: number) => void;
  page: number;
  setPage: (v: number) => void;
  onRecordClick: (r: RecordDetail) => void;
}) {
  return (
    <div className="results-tab">
      <div className="results-tab__controls">
        <div className="search-input">
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="confidence-filter">
          <label>Min confidence: {Math.round(minConfidence * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minConfidence}
            onChange={(e) => {
              setMinConfidence(Number(e.target.value));
              setPage(1);
            }}
          />
        </div>
      </div>

      {recordsQuery.isPending && <Spinner />}
      {recordsQuery.isError && <ErrorState message={recordsQuery.error.message} />}
      {recordsQuery.isSuccess && recordsQuery.data.items.length === 0 && (
        <EmptyState message="No records match your filters." />
      )}
      {recordsQuery.isSuccess && recordsQuery.data.items.length > 0 && (
        <>
          <div className="results-table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  {fields.slice(0, 5).map((f) => (
                    <th key={f.name}>{f.name.replace(/_/g, " ")}</th>
                  ))}
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recordsQuery.data.items.map((r) => (
                  <tr key={r.id} onClick={() => onRecordClick(r)} className="results-table__row">
                    {fields.slice(0, 5).map((f) => (
                      <td key={f.name}>
                        {String(r.data[f.name] ?? "—")}
                      </td>
                    ))}
                    <td>
                      <ConfidenceBar value={r.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              className="btn btn--sm btn--outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {recordsQuery.data.page} of {recordsQuery.data.total_pages} ({recordsQuery.data.total} records)
            </span>
            <button
              className="btn btn--sm btn--outline"
              disabled={page >= recordsQuery.data.total_pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SourcesTab({
  sourcesQuery,
}: {
  sourcesQuery: ReturnType<typeof useQuery<SourceDetail[]>>;
}) {
  return (
    <div className="sources-tab">
      {sourcesQuery.isPending && <Spinner />}
      {sourcesQuery.isError && <ErrorState message={sourcesQuery.error.message} />}
      {sourcesQuery.isSuccess && sourcesQuery.data.length === 0 && (
        <EmptyState message="No sources yet." />
      )}
      {sourcesQuery.isSuccess && sourcesQuery.data.length > 0 && (
        <div className="results-table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Records</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {sourcesQuery.data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">
                      {s.domain || s.url.substring(0, 50)}
                      <ExternalLink size={10} />
                    </a>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>{s.records_found}</td>
                  <td className="source-reason">{s.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistoryTab({
  runs,
}: {
  runs: { id: string; status: string; stats: RunStats; started_at: string | null; finished_at: string | null }[];
}) {
  if (runs.length === 0) return <EmptyState message="No runs yet." />;

  return (
    <div className="history-tab">
      <div className="results-table-wrap">
        <table className="results-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Records</th>
              <th>Started</th>
              <th>Finished</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={r.id}>
                <td>#{runs.length - i}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.stats.deduped_count ?? 0}</td>
                <td>{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                <td>{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordDrawer({
  record,
  onClose,
}: {
  record: RecordWithEvidence;
  onClose: () => void;
}) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__header">
          <h3>Record Detail</h3>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="drawer__content">
          <div className="drawer__section">
            <h4>Fields</h4>
            <div className="drawer__fields">
              {Object.entries(record.record.data).map(([key, value]) => (
                <div key={key} className="drawer__field">
                  <span className="drawer__field-name">{key.replace(/_/g, " ")}</span>
                  <span className="drawer__field-value">{String(value ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer__section">
            <h4>Confidence</h4>
            <ConfidenceBar value={record.record.confidence} />
          </div>

          {record.record.flags.length > 0 && (
            <div className="drawer__section">
              <h4>Flags</h4>
              <div className="drawer__flags">
                {record.record.flags.map((f, i) => (
                  <span key={i} className="flag-chip">{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className="drawer__section">
            <h4>Evidence ({record.evidence.length})</h4>
            {record.evidence.map((ev) => (
              <div key={ev.id} className="evidence-card">
                <blockquote className="evidence-card__snippet">
                  "{ev.snippet}"
                </blockquote>
                {ev.source_url && (
                  <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="evidence-card__source">
                    <ExternalLink size={12} />
                    {new URL(ev.source_url).hostname}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
