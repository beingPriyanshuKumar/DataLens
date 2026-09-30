from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class FieldSpec(BaseModel):
    name: str
    type: Literal["str", "int", "float", "bool", "date", "url", "email"]
    description: str
    required: bool

    @field_validator("name")
    @classmethod
    def name_must_be_snake_case(cls, v: str) -> str:
        cleaned = v.lower().replace(" ", "_")
        if not cleaned.replace("_", "").isalnum():
            msg = f"Field name must be snake_case alphanumeric: {v}"
            raise ValueError(msg)
        return cleaned


class TaskSpec(BaseModel):
    title: str = ""
    entity: str
    fields: list[FieldSpec]
    filters: dict[str, str] = Field(default_factory=dict)
    key_fields: list[str]
    target_count: int = 30
    region: str = "GLOBAL"
    source_hints: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    clarification: str | None = None

    @field_validator("region", mode="before")
    @classmethod
    def validate_region(cls, v: Any) -> str:
        from app.regions import validate_region_code

        return validate_region_code(str(v) if v else "GLOBAL")

    @field_validator("filters", mode="before")
    @classmethod
    def coerce_filter_values(cls, v: Any) -> dict[str, str]:
        """Coerce scalar filter values (int, float, bool) to strings.

        LLMs sometimes return numeric constraints like {max_salary: 100000}.
        Lists are joined with ', '. Nested dicts are rejected.
        """
        if not isinstance(v, dict):
            return {}
        result: dict[str, str] = {}
        for key, val in v.items():
            if isinstance(val, dict):
                msg = f"Nested dict not allowed in filters for key '{key}'"
                raise ValueError(msg)
            if isinstance(val, list):
                result[str(key)] = ", ".join(str(item) for item in val)
            elif isinstance(val, (int, float, bool)):
                result[str(key)] = str(val)
            elif val is None:
                continue
            else:
                result[str(key)] = str(val)
        return result


class PlanStep(BaseModel):
    type: Literal["search", "fetch", "extract", "validate", "dedupe"]
    description: str


class Plan(BaseModel):
    queries: list[str]
    steps: list[PlanStep]
    max_pages: int


class PreviewRequest(BaseModel):
    prompt: str
    region: str = "GLOBAL"


class PreviewResponse(BaseModel):
    spec: TaskSpec
    plan: Plan | None = None


class CreateTaskRequest(BaseModel):
    prompt: str
    spec: TaskSpec
    plan: Plan


class LatestRunSummary(BaseModel):
    id: str
    status: str
    started_at: str | None = None
    finished_at: str | None = None
    record_count: int = 0
    error: str | None = None


class TaskItem(BaseModel):
    id: str
    title: str
    prompt: str
    region: str
    created_at: str
    run_count: int
    latest_run: LatestRunSummary | None = None


class TaskListResponse(BaseModel):
    items: list[TaskItem]
    total: int


class PolicyResponse(BaseModel):
    user_agent: str
    honors_robots_txt: bool
    blocked_categories: list[str]
    blocked_domains: list[str]
    per_domain_delay_seconds: float
    max_pages_per_run: int
    max_response_bytes: int
    max_concurrent_runs: int


class TaskSummary(BaseModel):
    id: str
    prompt: str
    title: str
    status: str | None
    record_count: int
    last_run_at: str | None


class RunDetail(BaseModel):
    id: str
    task_id: str
    plan: dict
    status: str
    stats: dict
    error: str | None
    started_at: str | None
    finished_at: str | None


class RecordDetail(BaseModel):
    id: str
    run_id: str
    data: dict
    dedupe_key: str
    confidence: float
    flags: list[str]


class EvidenceDetail(BaseModel):
    id: str
    record_id: str
    source_id: str
    snippet: str
    source_url: str | None = None


class RecordWithEvidence(BaseModel):
    record: RecordDetail
    evidence: list[EvidenceDetail]


class SourceDetail(BaseModel):
    id: str
    run_id: str
    url: str
    domain: str
    status: str
    http_status: int | None
    reason: str | None
    records_found: int
    fetched_at: str


class PaginatedRecords(BaseModel):
    items: list[RecordDetail]
    total: int
    page: int
    page_size: int
    total_pages: int
