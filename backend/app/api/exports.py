from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Record, Run, Task
from app.schemas import TaskSpec

router = APIRouter(tags=["exports"])


@router.get("/runs/{run_id}/export")
async def export_records(
    run_id: str,
    format: str = Query(default="csv", pattern="^(csv|json|xlsx)$"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    run_result = await session.execute(select(Run).where(Run.id == run_id))
    run = run_result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    task_result = await session.execute(select(Task).where(Task.id == run.task_id))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    spec = TaskSpec.model_validate_json(task.spec)
    field_names = [f.name for f in spec.fields]

    records_result = await session.execute(
        select(Record).where(Record.run_id == run_id).order_by(Record.confidence.desc())
    )
    records = records_result.scalars().all()

    rows = []
    for r in records:
        data = json.loads(r.data)
        row = {name: data.get(name, "") for name in field_names}
        row["confidence"] = r.confidence
        rows.append(row)

    if format == "json":
        content = json.dumps(rows, indent=2, ensure_ascii=False)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=datalens_export_{run_id[:8]}.json"
            },
        )

    if format == "xlsx":
        try:
            from openpyxl import Workbook

            wb = Workbook()
            ws = wb.active
            ws.title = "Records"
            headers = field_names + ["confidence"]
            ws.append(headers)
            for row in rows:
                ws.append([row.get(h, "") for h in headers])
            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            return StreamingResponse(
                buf,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=datalens_export_{run_id[:8]}.xlsx"
                },
            )
        except ImportError:
            raise HTTPException(status_code=501, detail="XLSX export not available") from None

    # Default: CSV
    output = io.StringIO()
    headers = field_names + ["confidence"]
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    content = output.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=datalens_export_{run_id[:8]}.csv"},
    )
