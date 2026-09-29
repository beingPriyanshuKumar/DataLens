import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import select

from app.collectors.fetcher import FetchedPage
from app.collectors.policy import PolicyDecision
from app.collectors.search import SearchResult
from app.core.runner import execute_run
from app.db import async_session, create_all
from app.models import Record, RecordEvidence, Run, RunStatus, Source, Task
from app.schemas import FieldSpec, Plan, PlanStep, TaskSpec


@pytest.fixture(autouse=True)
async def setup_db():
    await create_all()


@pytest.mark.asyncio
async def test_full_pipeline_run():
    u = uuid.uuid4().hex[:8]
    task_id = f"task-runner-{u}"
    run_id = f"run-runner-{u}"

    spec = TaskSpec(
        title="Find AI Startups",
        entity="startup",
        fields=[
            FieldSpec(name="name", type="str", required=True, description="Startup name"),
            FieldSpec(name="funding", type="str", required=False, description="Total funding"),
        ],
        key_fields=["name"],
        target_count=5,
    )
    plan = Plan(
        queries=["ai startups seed funding 2026"],
        steps=[
            PlanStep(type="search", description="Search for startups"),
            PlanStep(type="fetch", description="Fetch pages"),
            PlanStep(type="extract", description="Extract records"),
            PlanStep(type="dedupe", description="Deduplicate"),
        ],
        max_pages=2,
    )

    async with async_session() as session:
        task = Task(id=task_id, prompt="Find AI Startups", spec=spec.model_dump_json())
        run = Run(id=run_id, task_id=task_id, plan=plan.model_dump_json(), status=RunStatus.QUEUED)
        session.add(task)
        session.add(run)
        await session.commit()

    mock_search_results = [
        SearchResult(
            url="https://tech-news.com/ai-startups", title="AI Startups 2026", snippet="..."
        ),
        SearchResult(url="https://blocked-domain.com/startups", title="Blocked", snippet="..."),
    ]

    mock_page_text = (
        "Cognition AI raised $21M in Series A funding. DevRev raised $100M at $1.1B valuation."
    )
    mock_extracted = [
        {
            "name": "Cognition AI",
            "funding": "$21M",
            "evidence": "Cognition AI raised $21M in Series A funding",
        },
        {
            "name": "DevRev",
            "funding": "$100M",
            "evidence": "DevRev raised $100M at $1.1B valuation",
        },
    ]

    async def mock_policy(url: str):
        if "blocked" in url:
            return PolicyDecision(allowed=False, reason="Blocked by policy")
        return PolicyDecision(allowed=True, reason="OK")

    async def mock_fetch(url: str):
        return FetchedPage(
            url=url,
            domain="tech-news.com",
            http_status=200,
            text=mock_page_text,
        )

    with (
        patch("app.core.runner.search_multiple", new=AsyncMock(return_value=mock_search_results)),
        patch("app.core.runner.is_allowed", side_effect=mock_policy),
        patch("app.core.runner.fetch_page", side_effect=mock_fetch),
        patch("app.core.runner.extract_from_page", new=AsyncMock(return_value=mock_extracted)),
    ):
        await execute_run(run_id)

    async with async_session() as session:
        # Check run status
        run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one()
        assert run.status == RunStatus.COMPLETED
        stats = json.loads(run.stats)
        assert stats["deduped_count"] == 2
        assert stats["pages_fetched"] == 1

        # Check sources
        sources = (
            (await session.execute(select(Source).where(Source.run_id == run_id))).scalars().all()
        )
        assert len(sources) == 2
        allowed_src = next(s for s in sources if "tech-news.com" in s.url)
        assert allowed_src.records_found == 2

        # Check records
        records = (
            (await session.execute(select(Record).where(Record.run_id == run_id))).scalars().all()
        )
        assert len(records) == 2
        names = [json.loads(r.data)["name"] for r in records]
        assert "Cognition AI" in names
        assert "DevRev" in names

        # Check record evidence
        evidence = (
            (
                await session.execute(
                    select(RecordEvidence).where(RecordEvidence.record_id == records[0].id)
                )
            )
            .scalars()
            .all()
        )
        assert len(evidence) >= 1
        assert "funding" in evidence[0].snippet


@pytest.mark.asyncio
async def test_pipeline_cancellation():
    u = uuid.uuid4().hex[:8]
    task_id = f"task-cancel-{u}"
    run_id = f"run-cancel-{u}"

    spec = TaskSpec(
        title="Test Cancel",
        entity="test",
        fields=[FieldSpec(name="title", type="str", required=True, description="Title")],
        key_fields=["title"],
    )
    plan = Plan(queries=["query 1"], steps=[], max_pages=5)

    async with async_session() as session:
        task = Task(id=task_id, prompt="Test Cancel", spec=spec.model_dump_json())
        run = Run(id=run_id, task_id=task_id, plan=plan.model_dump_json(), status=RunStatus.QUEUED)
        session.add(task)
        session.add(run)
        await session.commit()

    # Request cancellation
    async with async_session() as session:
        run_obj = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one()
        run_obj.status = RunStatus.CANCELLING
        session.add(run_obj)
        await session.commit()

    with patch("app.core.runner.search_multiple", new=AsyncMock(return_value=[])):
        await execute_run(run_id)

    async with async_session() as session:
        run = (await session.execute(select(Run).where(Run.id == run_id))).scalar_one()
        assert run.status == RunStatus.CANCELLED
