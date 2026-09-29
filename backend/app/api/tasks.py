from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.planner import build_plan
from app.core.runner import start_run
from app.core.spec import parse_prompt
from app.db import get_session
from app.models import Record, Run, RunStatus, Task
from app.schemas import (
    CreateTaskRequest,
    PreviewRequest,
    PreviewResponse,
    TaskSummary,
)

router = APIRouter(tags=["tasks"])


@router.post("/tasks/preview")
async def preview_task(req: PreviewRequest) -> PreviewResponse:
    spec = await parse_prompt(req.prompt)
    if spec.clarification:
        return PreviewResponse(spec=spec, plan=None)
    plan = await build_plan(spec)
    return PreviewResponse(spec=spec, plan=plan)


@router.post("/tasks")
async def create_task(
    req: CreateTaskRequest,
    session: AsyncSession = Depends(get_session),
) -> dict:
    task = Task(
        prompt=req.prompt,
        spec=req.spec.model_dump_json(),
    )
    session.add(task)
    await session.flush()

    run = Run(
        task_id=task.id,
        plan=req.plan.model_dump_json(),
        status=RunStatus.QUEUED,
    )
    session.add(run)
    await session.commit()

    start_run(run.id)

    return {"task_id": task.id, "run_id": run.id}


@router.get("/tasks")
async def list_tasks(
    session: AsyncSession = Depends(get_session),
) -> list[TaskSummary]:
    tasks_result = await session.execute(select(Task).order_by(Task.created_at.desc()))
    tasks = tasks_result.scalars().all()

    summaries: list[TaskSummary] = []
    for task in tasks:
        spec_data = json.loads(task.spec)
        title = spec_data.get("title", task.prompt[:50])

        latest_run_result = await session.execute(
            select(Run).where(Run.task_id == task.id).order_by(Run.started_at.desc()).limit(1)
        )
        latest_run = latest_run_result.scalar_one_or_none()

        record_count = 0
        status = None
        last_run_at = None
        if latest_run:
            status = latest_run.status.value if latest_run.status else None
            last_run_at = latest_run.started_at.isoformat() if latest_run.started_at else None
            count_result = await session.execute(
                select(func.count(Record.id)).where(Record.run_id == latest_run.id)
            )
            record_count = count_result.scalar() or 0

        summaries.append(
            TaskSummary(
                id=task.id,
                prompt=task.prompt,
                title=title,
                status=status,
                record_count=record_count,
                last_run_at=last_run_at,
            )
        )

    return summaries


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    runs_result = await session.execute(
        select(Run).where(Run.task_id == task_id).order_by(Run.started_at.desc())
    )
    runs = runs_result.scalars().all()

    return {
        "id": task.id,
        "prompt": task.prompt,
        "spec": json.loads(task.spec),
        "created_at": task.created_at.isoformat(),
        "runs": [
            {
                "id": r.id,
                "status": r.status.value,
                "stats": json.loads(r.stats),
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in runs
        ],
    }


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    runs_result = await session.execute(select(Run).where(Run.task_id == task_id))
    for run in runs_result.scalars().all():
        await session.delete(run)

    await session.delete(task)
    await session.commit()
    return {"deleted": True}
