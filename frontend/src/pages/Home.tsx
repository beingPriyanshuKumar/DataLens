import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Play,
  Trash2,
  RefreshCw,
  Database,
  Sparkles,
  ChevronRight,
  Eye,
} from "lucide-react";
import { listTasks, previewTask, createTask, deleteTask } from "../api";
import type { PreviewResponse, TaskSummary } from "../types";
import StatusBadge from "../components/StatusBadge";
import { Spinner, EmptyState, ErrorState } from "../components/Shared";

const EXAMPLE_PROMPTS = [
  "Find remote machine learning engineer openings posted in the last 2 weeks",
  "List 30 Indian SaaS startups that raised seed funding in 2025 with their founders",
  "Find companies that sponsored hackathons in India in the last two years",
];

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: listTasks,
  });

  const previewMutation = useMutation({
    mutationFn: (p: string) => previewTask(p),
    onSuccess: (data) => setPreview(data),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!preview?.spec || !preview?.plan) throw new Error("No preview");
      return createTask(prompt, preview.spec, preview.plan);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      navigate(`/tasks/${data.task_id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handlePreview = () => {
    if (!prompt.trim()) return;
    setPreview(null);
    previewMutation.mutate(prompt);
  };

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__logo">
          <Database size={32} />
          <h1>DataLens</h1>
        </div>
        <p className="home__subtitle">
          AI-powered data intelligence. Describe what you need — we'll find, verify, and deliver it.
        </p>
      </header>

      <section className="home__prompt-section">
        <div className="prompt-card">
          <div className="prompt-card__glow" />
          <label htmlFor="prompt-input" className="prompt-card__label">
            <Sparkles size={16} />
            What data do you need?
          </label>
          <textarea
            id="prompt-input"
            className="prompt-card__textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the data you want to collect..."
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePreview();
            }}
          />

          <div className="prompt-card__examples">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                className="example-chip"
                onClick={() => {
                  setPrompt(ex);
                  setPreview(null);
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            className="btn btn--primary btn--lg"
            onClick={handlePreview}
            disabled={!prompt.trim() || previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <>
                <Spinner size={16} /> Analyzing...
              </>
            ) : (
              <>
                <Eye size={16} /> Preview Plan
              </>
            )}
          </button>

          {previewMutation.isError && (
            <ErrorState message={previewMutation.error.message} />
          )}
        </div>

        {preview && (
          <div className="preview-panel">
            {preview.spec.clarification ? (
              <div className="preview-panel__clarification">
                <h3>Clarification Needed</h3>
                <p>{preview.spec.clarification}</p>
              </div>
            ) : (
              <>
                <h3 className="preview-panel__title">
                  <Sparkles size={16} />
                  {preview.spec.title}
                </h3>

                <div className="preview-panel__grid">
                  <div className="preview-panel__section">
                    <h4>Fields ({preview.spec.fields.length})</h4>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.spec.fields.map((f) => (
                          <tr key={f.name}>
                            <td>{f.name}</td>
                            <td><code>{f.type}</code></td>
                            <td>{f.required ? "✓" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="preview-panel__section">
                    <h4>Search Queries</h4>
                    <ul className="preview-list">
                      {preview.plan?.queries.map((q, i) => (
                        <li key={i}>
                          <Search size={12} />
                          {q}
                        </li>
                      ))}
                    </ul>

                    {preview.spec.assumptions.length > 0 && (
                      <>
                        <h4>Assumptions</h4>
                        <ul className="preview-list preview-list--muted">
                          {preview.spec.assumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {Object.keys(preview.spec.filters).length > 0 && (
                      <>
                        <h4>Filters</h4>
                        <ul className="preview-list">
                          {Object.entries(preview.spec.filters).map(([k, v]) => (
                            <li key={k}>
                              <strong>{k}:</strong> {v}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>

                {preview.plan && (
                  <div className="preview-panel__steps">
                    <h4>Pipeline Steps</h4>
                    <div className="step-flow">
                      {preview.plan.steps.map((s, i) => (
                        <div key={i} className="step-flow__item">
                          <span className="step-flow__badge">{s.type}</span>
                          <span>{s.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="btn btn--success btn--lg"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <>
                      <Spinner size={16} /> Starting...
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Run Collection
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <section className="home__tasks">
        <h2>
          <Database size={20} />
          Recent Tasks
        </h2>

        {tasksQuery.isPending && <Spinner />}
        {tasksQuery.isError && <ErrorState message={tasksQuery.error.message} />}
        {tasksQuery.isSuccess && tasksQuery.data.length === 0 && (
          <EmptyState message="No tasks yet. Create one above!" />
        )}

        {tasksQuery.isSuccess && tasksQuery.data.length > 0 && (
          <div className="task-list">
            {tasksQuery.data.map((task: TaskSummary) => (
              <div
                key={task.id}
                className="task-card"
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div className="task-card__header">
                  <h3>{task.title}</h3>
                  {task.status && <StatusBadge status={task.status} />}
                </div>
                <p className="task-card__prompt">{task.prompt}</p>
                <div className="task-card__footer">
                  <span className="task-card__stat">
                    <Database size={14} />
                    {task.record_count} records
                  </span>
                  {task.last_run_at && (
                    <span className="task-card__time">
                      {new Date(task.last_run_at).toLocaleDateString()}
                    </span>
                  )}
                  <div className="task-card__actions">
                    <button
                      className="btn btn--icon btn--ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(task.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="task-card__arrow" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
