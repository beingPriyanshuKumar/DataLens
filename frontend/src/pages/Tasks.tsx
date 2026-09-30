import { useState, useEffect, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "../components/Header";
import Footer from "../components/Footer";
import Button from "../components/Button";
import StatusPill from "../components/StatusPill";
import StateBlock from "../components/StateBlock";
import { listTasks, deleteTask, createRun, getExportUrl } from "../api";
import type { TaskItem } from "../types";
import "./Tasks.css";

const STATUS_FILTERS = ["ALL", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];

export default function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Tasks Log — DataLens";
    window.scrollTo(0, 0);
  }, []);

  // Filter params from URL
  const q = searchParams.get("q") || "";
  const statusParam = searchParams.get("status") || "ALL";
  const sortParam = searchParams.get("sort") || "newest";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = 20;

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [exportDropdownId, setExportDropdownId] = useState<string | null>(null);

  const updateFilters = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === "ALL" || (k === "page" && v === "1") || (k === "sort" && v === "newest")) {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    });
    setSearchParams(next);
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tasks", q, statusParam, sortParam, pageParam],
    queryFn: () =>
      listTasks({
        q: q || undefined,
        status: statusParam === "ALL" ? undefined : statusParam.toLowerCase(),
        sort: sortParam === "most_records" ? "updated_at" : "created_at",
        order: sortParam === "oldest" ? "asc" : "desc",
        limit: pageSize,
        offset: (pageParam - 1) * pageSize,
      }),
    refetchInterval: 10000,
  });

  const tasks: TaskItem[] = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteConfirmId(null);
    },
  });

  const reRunMutation = useMutation({
    mutationFn: (taskId: string) => createRun(taskId),
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      navigate(`/collect/${taskId}`);
    },
  });

  const formatIST = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const relativeTime = (isoString?: string | null) => {
    if (!isoString) return "—";
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="page-shell tasks-page">
      <Header />
      <main id="main-content" className="tasks-main" role="main">
        {/* Title Row */}
        <section className="tasks-hero">
          <div className="tasks-hero__title-wrap">
            <span className="tasks-hero__badge font-mono">// TASK REGISTRY</span>
            <h1 className="tasks-hero__title">
              Task Log <span className="tasks-hero__count font-mono">({total})</span>
            </h1>
          </div>
          <Button variant="primary" onClick={() => navigate("/collect")}>
            NEW TASK ↗
          </Button>
        </section>

        {/* Filter Bar */}
        <section className="tasks-filter-bar">
          <div className="tasks-search-wrap">
            <input
              type="text"
              className="tasks-search-input font-mono"
              placeholder="Filter by title or prompt..."
              value={q}
              onChange={(e) => updateFilters({ q: e.target.value, page: "1" })}
            />
          </div>

          <div className="tasks-status-tabs" role="tablist">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                className={`tasks-status-tab ${statusParam === f ? "tasks-status-tab--active" : ""}`}
                role="tab"
                aria-selected={statusParam === f}
                onClick={() => updateFilters({ status: f, page: "1" })}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="tasks-sort-wrap">
            <label htmlFor="tasks-sort-select" className="tasks-sort-label font-mono">
              SORT:
            </label>
            <select
              id="tasks-sort-select"
              className="tasks-sort-select font-mono"
              value={sortParam}
              onChange={(e) => updateFilters({ sort: e.target.value, page: "1" })}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most_records">Most Records</option>
            </select>
          </div>
        </section>

        {/* Table View */}
        <section className="tasks-table-section">
          {isLoading ? (
            <div className="tasks-state-padding">
              <StateBlock type="loading" title="Loading tasks log..." description="Querying task repository." />
            </div>
          ) : isError ? (
            <div className="tasks-state-padding">
              <StateBlock
                type="error"
                title="Could not load tasks"
                description="Failed to connect to the backend API."
                action={{ label: "RETRY", onClick: () => refetch() }}
              />
            </div>
          ) : tasks.length === 0 ? (
            <div className="tasks-state-padding">
              <StateBlock
                type="empty"
                title="No tasks found"
                description={
                  q || statusParam !== "ALL"
                    ? "No tasks match your filter criteria."
                    : "No collection tasks run yet. Describe the dataset you need to begin."
                }
                action={
                  q || statusParam !== "ALL"
                    ? { label: "CLEAR FILTERS", onClick: () => setSearchParams(new URLSearchParams()) }
                    : { label: "START A TASK ↗", onClick: () => navigate("/collect") }
                }
              />
            </div>
          ) : (
            <div className="tasks-table-wrap">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th style={{ width: "38%" }}>TASK</th>
                    <th style={{ width: "10%" }}>REGION</th>
                    <th style={{ width: "12%" }}>STATUS</th>
                    <th style={{ width: "8%" }}>RECORDS</th>
                    <th style={{ width: "6%" }}>RUNS</th>
                    <th style={{ width: "12%" }}>LAST RUN</th>
                    <th style={{ width: "14%" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const latest = task.latest_run;
                    const status = latest?.status || "pending";
                    const isExpanded = expandedTaskId === task.id;
                    const isDeleting = deleteConfirmId === task.id;
                    const isExporting = exportDropdownId === task.id;

                    return (
                      <Fragment key={task.id}>
                        <tr className={isExpanded ? "tasks-row--expanded" : ""}>
                          <td>
                            <div className="task-cell-main">
                              <span
                                className="task-cell-expand-btn font-mono"
                                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                title="Toggle run history"
                              >
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <div className="task-cell-meta">
                                <span
                                  className="task-cell-title"
                                  onClick={() => navigate(`/collect/${task.id}`)}
                                >
                                  {task.title || "Untitled Task"}
                                </span>
                                <p className="task-cell-prompt">{task.prompt}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="task-region-badge font-mono">{task.region || "GLOBAL"}</span>
                          </td>
                          <td>
                            <StatusPill status={status as any} />
                          </td>
                          <td className="font-mono">{latest?.record_count ?? 0}</td>
                          <td className="font-mono">{task.run_count || (task.runs?.length ?? 1)}</td>
                          <td title={`IST: ${formatIST(latest?.started_at || task.created_at)}`}>
                            <span className="task-time-rel">{relativeTime(latest?.started_at || task.created_at)}</span>
                          </td>
                          <td>
                            <div className="task-actions-cell">
                              <button
                                className="task-action-btn"
                                onClick={() => navigate(`/collect/${task.id}`)}
                                title="Open workspace"
                              >
                                OPEN ↗
                              </button>
                              <button
                                className="task-action-btn"
                                onClick={() => reRunMutation.mutate(task.id)}
                                disabled={reRunMutation.isPending}
                                title="Re-run collection"
                              >
                                RE-RUN
                              </button>
                              <div className="task-export-anchor">
                                <button
                                  className="task-action-btn"
                                  disabled={!latest || latest.record_count === 0}
                                  onClick={() => setExportDropdownId(isExporting ? null : task.id)}
                                  title={!latest || latest.record_count === 0 ? "No records to export" : "Export data"}
                                >
                                  EXPORT ▾
                                </button>
                                {isExporting && latest && (
                                  <div className="task-export-dropdown">
                                    <a
                                      href={getExportUrl(latest.id, "csv")}
                                      download
                                      className="task-export-opt font-mono"
                                      onClick={() => setExportDropdownId(null)}
                                    >
                                      CSV (.csv)
                                    </a>
                                    <a
                                      href={getExportUrl(latest.id, "xlsx")}
                                      download
                                      className="task-export-opt font-mono"
                                      onClick={() => setExportDropdownId(null)}
                                    >
                                      Excel (.xlsx)
                                    </a>
                                    <a
                                      href={getExportUrl(latest.id, "json")}
                                      download
                                      className="task-export-opt font-mono"
                                      onClick={() => setExportDropdownId(null)}
                                    >
                                      JSON (.json)
                                    </a>
                                  </div>
                                )}
                              </div>
                              {isDeleting ? (
                                <div className="task-delete-confirm">
                                  <span className="font-mono">DELETE?</span>
                                  <button
                                    className="task-delete-yes"
                                    onClick={() => deleteMutation.mutate(task.id)}
                                  >
                                    YES
                                  </button>
                                  <button
                                    className="task-delete-no"
                                    onClick={() => setDeleteConfirmId(null)}
                                  >
                                    NO
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="task-action-btn task-action-btn--danger"
                                  onClick={() => setDeleteConfirmId(task.id)}
                                  title="Delete task"
                                >
                                  DEL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${task.id}-runs`} className="tasks-subrow">
                            <td colSpan={7}>
                              <div className="task-runs-panel">
                                <div className="task-runs-header font-mono">
                                  RUN HISTORY FOR TASK #{task.id.slice(0, 8)}
                                </div>
                                {task.runs && task.runs.length > 0 ? (
                                  <table className="task-runs-subtable">
                                    <thead>
                                      <tr>
                                        <th>RUN ID</th>
                                        <th>STATUS</th>
                                        <th>RECORDS</th>
                                        <th>STARTED (IST)</th>
                                        <th>ACTIONS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {task.runs.map((r) => (
                                        <tr key={r.id}>
                                          <td className="font-mono">{r.id.slice(0, 8)}</td>
                                          <td>
                                            <StatusPill status={r.status as any} />
                                          </td>
                                          <td className="font-mono">{r.record_count}</td>
                                          <td className="font-mono">{formatIST(r.started_at)}</td>
                                          <td>
                                            <div className="task-runs-actions">
                                              <a
                                                href={getExportUrl(r.id, "csv")}
                                                download
                                                className="task-sub-link font-mono"
                                              >
                                                CSV
                                              </a>
                                              <a
                                                href={getExportUrl(r.id, "xlsx")}
                                                download
                                                className="task-sub-link font-mono"
                                              >
                                                XLSX
                                              </a>
                                              <a
                                                href={getExportUrl(r.id, "json")}
                                                download
                                                className="task-sub-link font-mono"
                                              >
                                                JSON
                                              </a>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="task-runs-empty">No run snapshots logged for this task.</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="tasks-pagination">
              <span className="tasks-page-info font-mono">
                PAGE {pageParam} OF {totalPages}
              </span>
              <div className="tasks-page-btns">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={pageParam <= 1}
                  onClick={() => updateFilters({ page: String(pageParam - 1) })}
                >
                  ← PREV
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={pageParam >= totalPages}
                  onClick={() => updateFilters({ page: String(pageParam + 1) })}
                >
                  NEXT →
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
