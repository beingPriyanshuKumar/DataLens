from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.runner import start_run
from app.db import async_session, get_session
from app.models import Run, RunEvent, RunStatus, Source
from app.schemas import RunDetail, SourceDetail

router = APIRouter(tags=["runs"])

TERMINAL_STATUSES = {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> RunDetail:
    result = await session.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    return RunDetail(
        id=run.id,
        task_id=run.task_id,
        plan=json.loads(run.plan),
        status=run.status.value,
        stats=json.loads(run.stats),
        error=run.error,
        started_at=run.started_at.isoformat() if run.started_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
    )


@router.post("/tasks/{task_id}/runs")
async def create_run(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    from app.models import Task

    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    latest_result = await session.execute(
        select(Run).where(Run.task_id == task_id).order_by(Run.started_at.desc()).limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    plan_json = latest.plan if latest else "{}"

    run = Run(task_id=task_id, plan=plan_json, status=RunStatus.QUEUED)
    session.add(run)
    await session.commit()

    start_run(run.id)
    return {"run_id": run.id}


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in (RunStatus.QUEUED, RunStatus.RUNNING):
        raise HTTPException(status_code=400, detail="Run is not active")

    run.status = RunStatus.CANCELLING
    session.add(run)
    await session.commit()
    return {"status": "cancelling"}


@router.get("/runs/{run_id}/events")
async def stream_events(run_id: str, request: Request, after: int = 0):
    async def event_generator():
        cursor = after
        while True:
            if await request.is_disconnected():
                break

            async with async_session() as session:
                result = await session.execute(
                    select(RunEvent)
                    .where(RunEvent.run_id == run_id, RunEvent.id > cursor)
                    .order_by(RunEvent.id)
                )
                events = result.scalars().all()

                for event in events:
                    cursor = event.id
                    yield {
                        "event": "log",
                        "id": str(event.id),
                        "data": json.dumps(
                            {
                                "id": event.id,
                                "level": event.level.value,
                                "step": event.step,
                                "message": event.message,
                                "created_at": event.created_at.isoformat(),
                            }
                        ),
                    }

                run_result = await session.execute(select(Run).where(Run.id == run_id))
                run = run_result.scalar_one_or_none()
                if run and run.status in TERMINAL_STATUSES and not events:
                    yield {
                        "event": "done",
                        "data": json.dumps({"status": run.status.value}),
                    }
                    break

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/runs/{run_id}/sources")
async def list_sources(
    run_id: str,
    session: AsyncSession = Depends(get_session),
) -> list[SourceDetail]:
    result = await session.execute(
        select(Source).where(Source.run_id == run_id).order_by(Source.fetched_at.desc())
    )
    sources = result.scalars().all()
    return [
        SourceDetail(
            id=s.id,
            run_id=s.run_id,
            url=s.url,
            domain=s.domain,
            status=s.status.value,
            http_status=s.http_status,
            reason=s.reason,
            records_found=s.records_found,
            fetched_at=s.fetched_at.isoformat(),
        )
        for s in sources
    ]
