from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Record, Run, Source, Task
from app.processing.report import build_report
from app.schemas import TaskSpec

router = APIRouter(tags=["reports"])


@router.get("/runs/{run_id}/report")
async def get_report(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Return the trust report for a completed run."""
    run_result = await session.execute(select(Run).where(Run.id == run_id))
    run = run_result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    task_result = await session.execute(select(Task).where(Task.id == run.task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    # Use run_spec if available, else fall back to task spec
    spec_json = run.run_spec if run.run_spec and run.run_spec != "{}" else task.spec
    spec = TaskSpec.model_validate_json(spec_json)
    fields_dicts = [{"name": f.name, "type": f.type, "required": f.required} for f in spec.fields]

    stats = json.loads(run.stats) if run.stats else {}

    records_result = await session.execute(select(Record).where(Record.run_id == run_id))
    records = [
        {"data": json.loads(r.data), "confidence": r.confidence, "flags": json.loads(r.flags)}
        for r in records_result.scalars().all()
    ]

    sources_result = await session.execute(select(Source).where(Source.run_id == run_id))
    sources = [
        {
            "id": s.id,
            "status": s.status.value,
            "domain": s.domain,
            "records_found": s.records_found,
            "reason": s.reason,
        }
        for s in sources_result.scalars().all()
    ]

    report = build_report(stats, records, sources, fields_dicts)
    return asdict(report)
