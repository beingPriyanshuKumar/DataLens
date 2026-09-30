from __future__ import annotations

import json
import uuid

import httpx
import pytest

from app.db import async_session, create_all
from app.main import app
from app.models import Record, Run, RunStatus, Source, SourceStatus, Task
from app.schemas import FieldSpec, TaskSpec


@pytest.fixture(autouse=True)
async def setup_db():
    await create_all()


@pytest.mark.asyncio
async def test_get_report_and_diagnostics_endpoints():
    task_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())

    spec = TaskSpec(
        entity="startup",
        fields=[
            FieldSpec(name="name", type="str", required=True, description="Startup name"),
            FieldSpec(name="funding", type="str", required=False, description="Funding"),
        ],
        key_fields=["name"],
        target_count=10,
    )

    async with async_session() as session:
        task = Task(
            id=task_id,
            prompt="Find 10 AI startups with funding",
            spec=spec.model_dump_json(),
        )
        session.add(task)

        run = Run(
            id=run_id,
            task_id=task_id,
            status=RunStatus.COMPLETED,
            plan=json.dumps({"queries": ["ai startups 2026"]}),
            run_spec=spec.model_dump_json(),
            stats=json.dumps(
                {
                    "raw_count": 8,
                    "verified_count": 6,
                    "valid_count": 6,
                    "deduped_count": 5,
                    "hallucinated_count": 2,
                    "pages_fetched": 4,
                }
            ),
        )
        session.add(run)

        rec = Record(
            id=str(uuid.uuid4()),
            run_id=run_id,
            dedupe_key="startup-one",
            data=json.dumps({"name": "Startup One", "funding": "$5M"}),
            confidence=0.92,
            flags=json.dumps([]),
        )
        session.add(rec)

        src = Source(
            id=str(uuid.uuid4()),
            run_id=run_id,
            url="https://techcrunch.com/startup-one",
            domain="techcrunch.com",
            status=SourceStatus.FETCHED,
            http_status=200,
            records_found=1,
        )
        session.add(src)

        await session.commit()

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        # 1. Report endpoint
        report_resp = await client.get(f"/api/runs/{run_id}/report")
        assert report_resp.status_code == 200
        report_data = report_resp.json()
        assert "funnel" in report_data
        assert "trust_signals" in report_data
        assert "field_completeness" in report_data
        assert "sources_summary" in report_data
        assert report_data["record_count"] == 5
        assert report_data["source_count"] == 1

        # 2. Diagnostics endpoint
        diag_resp = await client.get(f"/api/runs/{run_id}/diagnostics")
        assert diag_resp.status_code == 200
        diags = diag_resp.json()
        assert isinstance(diags, list)

        # 3. 404 for unknown run
        unknown_resp = await client.get("/api/runs/unknown-run-id/report")
        assert unknown_resp.status_code == 404
