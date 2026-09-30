from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Record, Run, Source, Task

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def get_stats(
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    """Return platform-wide operational statistics."""
    tasks_res = await session.execute(select(func.count(Task.id)))
    tasks_count = tasks_res.scalar() or 0

    runs_res = await session.execute(select(Run.stats))
    stats_list = runs_res.scalars().all()
    runs_count = len(stats_list)

    unsupported_blocked = 0
    for s_json in stats_list:
        if s_json:
            try:
                data = json.loads(s_json)
                unsupported_blocked += int(data.get("hallucinated_count", 0))
            except Exception:
                pass

    records_res = await session.execute(select(func.count(Record.id)))
    records_count = records_res.scalar() or 0

    sources_res = await session.execute(select(func.count(Source.id)))
    sources_count = sources_res.scalar() or 0

    return {
        "tasks": tasks_count,
        "runs": runs_count,
        "records_verified": records_count,
        "sources_checked": sources_count,
        "unsupported_records_blocked": unsupported_blocked,
    }
