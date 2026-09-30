import enum
import uuid
from datetime import UTC, datetime

from sqlmodel import Column, Enum, Field, Relationship, SQLModel, Text


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class RunStatus(enum.StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"


class EventLevel(enum.StrEnum):
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class SourceStatus(enum.StrEnum):
    FETCHED = "fetched"
    BLOCKED_BY_POLICY = "blocked_by_policy"
    BLOCKED_BY_ROBOTS = "blocked_by_robots"
    FAILED = "failed"
    SKIPPED = "skipped"


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(default_factory=_uuid, primary_key=True)
    prompt: str = Field(sa_column=Column(Text))
    spec: str = Field(default="{}", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    runs: list["Run"] = Relationship(
        back_populates="task",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Run(SQLModel, table=True):
    __tablename__ = "runs"

    id: str = Field(default_factory=_uuid, primary_key=True)
    task_id: str = Field(foreign_key="tasks.id", index=True)
    plan: str = Field(default="{}", sa_column=Column(Text))
    status: RunStatus = Field(default=RunStatus.QUEUED, sa_column=Column(Enum(RunStatus)))
    stats: str = Field(default="{}", sa_column=Column(Text))
    run_spec: str = Field(default="{}", sa_column=Column(Text))
    error: str | None = Field(default=None, sa_column=Column(Text))
    started_at: datetime | None = None
    finished_at: datetime | None = None

    task: Task | None = Relationship(back_populates="runs")
    events: list["RunEvent"] = Relationship(
        back_populates="run",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    sources: list["Source"] = Relationship(
        back_populates="run",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    records: list["Record"] = Relationship(
        back_populates="run",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class RunEvent(SQLModel, table=True):
    __tablename__ = "run_events"

    id: int | None = Field(default=None, primary_key=True)
    run_id: str = Field(foreign_key="runs.id", index=True)
    level: EventLevel = Field(sa_column=Column(Enum(EventLevel)))
    step: str
    message: str = Field(sa_column=Column(Text))
    data: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=_now)

    run: Run | None = Relationship(back_populates="events")


class Source(SQLModel, table=True):
    __tablename__ = "sources"

    id: str = Field(default_factory=_uuid, primary_key=True)
    run_id: str = Field(foreign_key="runs.id", index=True)
    url: str = Field(sa_column=Column(Text))
    domain: str = ""
    status: SourceStatus = Field(sa_column=Column(Enum(SourceStatus)))
    http_status: int | None = None
    reason: str | None = Field(default=None, sa_column=Column(Text))
    records_found: int = 0
    fetched_at: datetime = Field(default_factory=_now)

    run: Run | None = Relationship(back_populates="sources")
    evidence: list["RecordEvidence"] = Relationship(
        back_populates="source",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Record(SQLModel, table=True):
    __tablename__ = "records"

    id: str = Field(default_factory=_uuid, primary_key=True)
    run_id: str = Field(foreign_key="runs.id", index=True)
    data: str = Field(default="{}", sa_column=Column(Text))
    dedupe_key: str = ""
    confidence: float = 0.0
    flags: str = Field(default="[]", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=_now)

    run: Run | None = Relationship(back_populates="records")
    evidence: list["RecordEvidence"] = Relationship(
        back_populates="record",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class RecordEvidence(SQLModel, table=True):
    __tablename__ = "record_evidence"

    id: str = Field(default_factory=_uuid, primary_key=True)
    record_id: str = Field(foreign_key="records.id", index=True)
    source_id: str = Field(foreign_key="sources.id")
    snippet: str = Field(sa_column=Column(Text))

    record: Record | None = Relationship(back_populates="evidence")
    source: Source | None = Relationship(back_populates="evidence")
