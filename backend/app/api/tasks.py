from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.planner import build_plan
from app.core.rate_limit import api_limiter
from app.core.runner import start_run
from app.core.spec import parse_prompt
from app.db import get_session
from app.models import Record, RecordEvidence, Run, RunEvent, RunStatus, Source, Task
from app.schemas import (
    CreateTaskRequest,
    LatestRunSummary,
    Plan,
    PreviewRequest,
    PreviewResponse,
    TaskItem,
    TaskListResponse,
    TaskSpec,
    TaskSummary,
)

router = APIRouter(tags=["tasks"])


@router.post("/tasks/preview")
async def preview_task(req: PreviewRequest, request: Request) -> PreviewResponse:
    await api_limiter.check(request)
    spec = await parse_prompt(req.prompt, region_code=req.region)
    if spec.clarification:
        return PreviewResponse(spec=spec, plan=None)
    plan = await build_plan(spec)
    return PreviewResponse(spec=spec, plan=plan)


@router.post("/tasks")
async def create_task(
    req: CreateTaskRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    await api_limiter.check(request)
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
    response: Response,
    q: str | None = None,
    status: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
) -> TaskListResponse:
    base_query = select(Task)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        base_query = base_query.where(
            or_(Task.prompt.ilike(pattern), Task.spec.ilike(pattern))
        )

    if sort == "updated_at":
        order_col = Task.updated_at.desc() if order.lower() == "desc" else Task.updated_at.asc()
    else:
        order_col = Task.created_at.desc() if order.lower() == "desc" else Task.created_at.asc()

    total_result = await session.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = total_result.scalar() or 0

    tasks_result = await session.execute(
        base_query.order_by(order_col).offset(offset).limit(limit)
    )
    tasks = tasks_result.scalars().all()

    items: list[TaskItem] = []
    for task in tasks:
        spec_data = json.loads(task.spec)
        title = spec_data.get("title") or task.prompt[:50]
        region = spec_data.get("region", "GLOBAL")

        runs_res = await session.execute(
            select(Run).where(Run.task_id == task.id).order_by(Run.started_at.desc())
        )
        runs = runs_res.scalars().all()
        run_count = len(runs)
        latest_run = runs[0] if runs else None

        latest_summary = None
        if latest_run:
            count_result = await session.execute(
                select(func.count(Record.id)).where(Record.run_id == latest_run.id)
            )
            rec_count = count_result.scalar() or 0
            latest_summary = LatestRunSummary(
                id=latest_run.id,
                status=latest_run.status.value if latest_run.status else "queued",
                started_at=latest_run.started_at.isoformat() if latest_run.started_at else None,
                finished_at=latest_run.finished_at.isoformat() if latest_run.finished_at else None,
                record_count=rec_count,
                error=latest_run.error,
            )

        if status and status.lower() != "all":
            if not latest_run or latest_run.status.value.lower() != status.lower():
                continue

        items.append(
            TaskItem(
                id=task.id,
                title=title,
                prompt=task.prompt,
                region=region,
                created_at=task.created_at.isoformat(),
                run_count=run_count,
                latest_run=latest_summary,
            )
        )

    response.headers["X-Total-Count"] = str(total)
    return TaskListResponse(items=items, total=total)


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
    spec_data = json.loads(task.spec)

    run_list = []
    for r in runs:
        count_res = await session.execute(
            select(func.count(Record.id)).where(Record.run_id == r.id)
        )
        rec_count = count_res.scalar() or 0
        run_list.append(
            {
                "id": r.id,
                "status": r.status.value,
                "stats": json.loads(r.stats) if r.stats else {},
                "record_count": rec_count,
                "error": r.error,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
        )

    return {
        "id": task.id,
        "prompt": task.prompt,
        "spec": spec_data,
        "region": spec_data.get("region", "GLOBAL"),
        "created_at": task.created_at.isoformat(),
        "runs": run_list,
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
    runs = runs_result.scalars().all()
    run_ids = [r.id for r in runs]

    if run_ids:
        # 1. Delete associated evidence and records
        records_result = await session.execute(select(Record.id).where(Record.run_id.in_(run_ids)))
        record_ids = [r[0] for r in records_result.all()]
        if record_ids:
            await session.execute(
                delete(RecordEvidence).where(RecordEvidence.record_id.in_(record_ids))
            )
            await session.execute(delete(Record).where(Record.id.in_(record_ids)))

        # 2. Delete sources and run events
        await session.execute(delete(Source).where(Source.run_id.in_(run_ids)))
        await session.execute(delete(RunEvent).where(RunEvent.run_id.in_(run_ids)))

        # 3. Delete runs
        await session.execute(delete(Run).where(Run.id.in_(run_ids)))

    # 4. Delete the task
    await session.delete(task)
    await session.commit()
    return {"deleted": True}
