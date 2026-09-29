export interface FieldSpec {
  name: string;
  type: "str" | "int" | "float" | "bool" | "date" | "url" | "email";
  description: string;
  required: boolean;
}

export interface TaskSpec {
  title: string;
  entity: string;
  fields: FieldSpec[];
  filters: Record<string, string>;
  key_fields: string[];
  target_count: number;
  source_hints: string[];
  assumptions: string[];
  clarification: string | null;
}

export interface PlanStep {
  type: "search" | "fetch" | "extract" | "validate" | "dedupe";
  description: string;
}

export interface Plan {
  queries: string[];
  steps: PlanStep[];
  max_pages: number;
}

export interface PreviewResponse {
  spec: TaskSpec;
  plan: Plan | null;
}

export interface TaskSummary {
  id: string;
  prompt: string;
  title: string;
  status: string | null;
  record_count: number;
  last_run_at: string | null;
}

export interface RunDetail {
  id: string;
  task_id: string;
  plan: Record<string, unknown>;
  status: string;
  stats: RunStats;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunStats {
  raw_count?: number;
  verified_count?: number;
  valid_count?: number;
  deduped_count?: number;
  pages_fetched?: number;
  pages_failed?: number;
  hallucinated_count?: number;
}

export interface RecordDetail {
  id: string;
  run_id: string;
  data: Record<string, unknown>;
  dedupe_key: string;
  confidence: number;
  flags: string[];
}

export interface EvidenceDetail {
  id: string;
  record_id: string;
  source_id: string;
  snippet: string;
  source_url: string | null;
}

export interface RecordWithEvidence {
  record: RecordDetail;
  evidence: EvidenceDetail[];
}

export interface SourceDetail {
  id: string;
  run_id: string;
  url: string;
  domain: string;
  status: string;
  http_status: number | null;
  reason: string | null;
  records_found: number;
  fetched_at: string;
}

export interface PaginatedRecords {
  items: RecordDetail[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RunEvent {
  id: number;
  level: "info" | "warn" | "error";
  step: string;
  message: string;
  created_at: string;
}

export interface TaskDetail {
  id: string;
  prompt: string;
  spec: TaskSpec;
  created_at: string;
  runs: {
    id: string;
    status: string;
    stats: RunStats;
    started_at: string | null;
    finished_at: string | null;
  }[];
}
