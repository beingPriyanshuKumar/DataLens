import json
import uuid
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.db import create_all
from app.main import app
from app.models import Record, RecordEvidence, Run, RunStatus, Source, SourceStatus, Task
from app.schemas import FieldSpec, Plan, PlanStep, TaskSpec


@pytest.fixture(autouse=True)
async def setup_db():
    await create_all()


@pytest.mark.asyncio
async def test_health():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_preview_task():
    mock_spec = TaskSpec(
        entity="job_posting",
        fields=[
            FieldSpec(name="title", type="str", required=True, description="Job title"),
            FieldSpec(name="company", type="str", required=True, description="Company name"),
        ],
        key_fields=["title", "company"],
        target_count=10,
        assumptions=["Only software engineering jobs"],
    )
    mock_plan = Plan(
        queries=["software engineer jobs 2026", "remote developer openings"],
        steps=[
            PlanStep(type="search", description="Search for jobs"),
            PlanStep(type="fetch", description="Fetch pages"),
            PlanStep(type="extract", description="Extract fields"),
            PlanStep(type="dedupe", description="Deduplicate"),
        ],
        max_pages=20,
    )

    with (
        patch("app.api.tasks.parse_prompt", new=AsyncMock(return_value=mock_spec)),
        patch("app.api.tasks.build_plan", new=AsyncMock(return_value=mock_plan)),
    ):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/tasks/preview",
                json={"prompt": "Find 10 software engineer jobs"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["spec"]["entity"] == "job_posting"
            assert len(data["plan"]["queries"]) == 2


@pytest.mark.asyncio
async def test_task_lifecycle_and_records(async_session=None):
    from app.db import async_session as session_factory

    # 1. Create a task and run directly in DB
    u = uuid.uuid4().hex[:8]
    task_id = f"test-task-{u}"
    run_id = f"test-run-{u}"

    spec = TaskSpec(
        entity="company",
        fields=[
            FieldSpec(name="name", type="str", required=True, description="Company name"),
            FieldSpec(name="valuation", type="str", required=False, description="Valuation"),
        ],
        key_fields=["name"],
    )
    plan = Plan(
        queries=["top companies 2026"],
        steps=[
            PlanStep(type="search", description="Search"),
            PlanStep(type="extract", description="Extract"),
        ],
        max_pages=10,
    )

    async with session_factory() as session:
        task = Task(id=task_id, prompt="Find top companies", spec=spec.model_dump_json())
        run = Run(
            id=run_id, task_id=task_id, plan=plan.model_dump_json(), status=RunStatus.COMPLETED
        )
        session.add(task)
        session.add(run)

        # Add Source
        source = Source(
            id=f"src-{u}",
            run_id=run_id,
            url="https://techcrunch.com/article",
            domain="techcrunch.com",
            status=SourceStatus.FETCHED,
            records_found=1,
        )
        session.add(source)

        # Add Record
        record = Record(
            id=f"rec-{u}",
            run_id=run_id,
            data=json.dumps({"name": "OpenAI", "valuation": "$80B"}),
            dedupe_key=f"hash{u}",
            confidence=0.95,
            flags=json.dumps([]),
        )
        session.add(record)
        await session.flush()

        evidence = RecordEvidence(
            record_id=record.id,
            source_id=source.id,
            snippet="OpenAI reaches $80B valuation in tender offer",
        )
        session.add(evidence)
        await session.commit()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 2. List tasks
        resp = await client.get("/api/tasks")
        assert resp.status_code == 200
        tasks_data = resp.json()
        tasks = tasks_data["items"] if isinstance(tasks_data, dict) and "items" in tasks_data else tasks_data
        assert any(t["id"] == task_id for t in tasks)

        # 3. Get task
        resp = await client.get(f"/api/tasks/{task_id}")
        assert resp.status_code == 200
        assert resp.json()["prompt"] == "Find top companies"

        # 4. Get run
        resp = await client.get(f"/api/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

        # 5. Get sources
        resp = await client.get(f"/api/runs/{run_id}/sources")
        assert resp.status_code == 200
        sources = resp.json()
        assert len(sources) >= 1
        assert sources[0]["domain"] == "techcrunch.com"

        # 6. Get records with pagination & confidence filtering
        resp = await client.get(f"/api/runs/{run_id}/records?min_confidence=0.8")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["data"]["name"] == "OpenAI"

        # 7. Get single record with evidence
        resp = await client.get(f"/api/records/{record.id}")
        assert resp.status_code == 200
        detail = resp.json()
        assert len(detail["evidence"]) == 1
        assert detail["evidence"][0]["source_url"] == "https://techcrunch.com/article"

        # 8. CSV export
        resp = await client.get(f"/api/runs/{run_id}/export?format=csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert "OpenAI" in resp.text

        # 9. JSON export
        resp = await client.get(f"/api/runs/{run_id}/export?format=json")
        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]
        exported = resp.json()
        assert exported[0]["name"] == "OpenAI"

        # 10. Delete task
        resp = await client.delete(f"/api/tasks/{task_id}")
        assert resp.status_code == 200
        assert resp.json() == {"deleted": True}

        # Verify cascade: child run, source, record, and evidence are completely removed
        from sqlmodel import select

        async with session_factory() as session:
            assert (
                await session.execute(select(Run).where(Run.id == run_id))
            ).scalar_one_or_none() is None
            assert (
                await session.execute(select(Source).where(Source.id == f"src-{u}"))
            ).scalar_one_or_none() is None
            assert (
                await session.execute(select(Record).where(Record.id == f"rec-{u}"))
            ).scalar_one_or_none() is None
            assert (
                await session.execute(
                    select(RecordEvidence).where(RecordEvidence.record_id == f"rec-{u}")
                )
            ).scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_stats_endpoint():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert "runs" in data
        assert "records_verified" in data
        assert "sources_checked" in data
        assert "unsupported_records_blocked" in data
        assert isinstance(data["tasks"], int)
        assert isinstance(data["runs"], int)
        assert isinstance(data["records_verified"], int)
        assert isinstance(data["sources_checked"], int)
        assert isinstance(data["unsupported_records_blocked"], int)
