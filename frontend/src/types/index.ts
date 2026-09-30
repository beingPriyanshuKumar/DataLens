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
  first_record_seconds?: number;
  dropped_reasons?: Record<string, number>;
  filters?: Record<string, string>;
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
  data?: Record<string, any>;
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

export interface PlatformStats {
  tasks: number;
  runs: number;
  records_verified: number;
  sources_checked: number;
  unsupported_records_blocked: number;
}

export interface TrustSignal {
  name: string;
  label: string;
  formula: string;
  value: number;
  threshold: number;
  passed: boolean;
}

export interface FieldCompleteness {
  name: string;
  non_null_count: number;
  total: number;
  share: number;
}

export interface FunnelStep {
  label: string;
  count: number;
  dropped: number;
  drop_reasons: Record<string, number>;
}

export interface SourcesSummary {
  fetched: number;
  blocked_by_policy: number;
  blocked_by_robots: number;
  failed: number;
  total: number;
}

export interface TrustReport {
  funnel: FunnelStep[];
  trust_signals: TrustSignal[];
  field_completeness: FieldCompleteness[];
  sources_summary: SourcesSummary;
  record_count: number;
  source_count: number;
}

export interface DiagnosticItem {
  rule: string;
  severity: "warning" | "info";
  message: string;
  action: string | null;
}

export interface TemplateSlot {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}

export interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  slots: TemplateSlot[];
  assemblePrompt: (values: Record<string, string>) => string;
}

