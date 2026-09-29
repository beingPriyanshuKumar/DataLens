import type {
  PaginatedRecords,
  PreviewResponse,
  RecordWithEvidence,
  RunDetail,
  SourceDetail,
  TaskDetail,
  TaskSpec,
  Plan,
  TaskSummary,
} from "../types";

const BASE = "http://localhost:8000/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || res.statusText);
  }
  return res.json();
}

export async function previewTask(prompt: string): Promise<PreviewResponse> {
  return request("/tasks/preview", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function createTask(
  prompt: string,
  spec: TaskSpec,
  plan: Plan
): Promise<{ task_id: string; run_id: string }> {
  return request("/tasks", {
    method: "POST",
    body: JSON.stringify({ prompt, spec, plan }),
  });
}

export async function listTasks(): Promise<TaskSummary[]> {
  return request("/tasks");
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  return request(`/tasks/${taskId}`);
}

export async function deleteTask(taskId: string): Promise<void> {
  return request(`/tasks/${taskId}`, { method: "DELETE" });
}

export async function getRun(runId: string): Promise<RunDetail> {
  return request(`/runs/${runId}`);
}

export async function createRun(
  taskId: string
): Promise<{ run_id: string }> {
  return request(`/tasks/${taskId}/runs`, { method: "POST" });
}

export async function cancelRun(runId: string): Promise<void> {
  return request(`/runs/${runId}/cancel`, { method: "POST" });
}

export async function getRecords(
  runId: string,
  params: {
    q?: string;
    min_confidence?: number;
    sort?: string;
    order?: string;
    page?: number;
    page_size?: number;
  } = {}
): Promise<PaginatedRecords> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      search.set(k, String(v));
    }
  });
  return request(`/runs/${runId}/records?${search}`);
}

export async function getRecord(
  recordId: string
): Promise<RecordWithEvidence> {
  return request(`/records/${recordId}`);
}

export async function getSources(
  runId: string
): Promise<SourceDetail[]> {
  return request(`/runs/${runId}/sources`);
}

export function getExportUrl(
  runId: string,
  format: "csv" | "json" | "xlsx"
): string {
  return `${BASE}/runs/${runId}/export?format=${format}`;
}

export function createEventSource(
  runId: string,
  afterId: number = 0
): EventSource {
  return new EventSource(
    `${BASE}/runs/${runId}/events?after=${afterId}`
  );
}
