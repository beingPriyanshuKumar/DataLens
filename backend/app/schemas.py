from __future__ import annotations

from typing import Literal

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
    source_hints: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    clarification: str | None = None


class PlanStep(BaseModel):
    type: Literal["search", "fetch", "extract", "validate", "dedupe"]
    description: str


class Plan(BaseModel):
    queries: list[str]
    steps: list[PlanStep]
    max_pages: int


class PreviewRequest(BaseModel):
    prompt: str


class PreviewResponse(BaseModel):
    spec: TaskSpec
    plan: Plan | None = None


class CreateTaskRequest(BaseModel):
    prompt: str
    spec: TaskSpec
    plan: Plan


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
