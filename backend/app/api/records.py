from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Record, RecordEvidence, Source
from app.schemas import (
    EvidenceDetail,
    PaginatedRecords,
    RecordDetail,
    RecordWithEvidence,
)

router = APIRouter(tags=["records"])


@router.get("/runs/{run_id}/records")
async def list_records(
    run_id: str,
    q: str | None = None,
    min_confidence: float | None = None,
    sort: str = "confidence",
    order: str = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> PaginatedRecords:
    query = select(Record).where(Record.run_id == run_id)

    if min_confidence is not None:
        query = query.where(Record.confidence >= min_confidence)

    if q:
        query = query.where(Record.data.contains(q))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    col = Record.confidence if sort == "confidence" else Record.created_at
    query = query.order_by(col.asc() if order == "asc" else col.desc())

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    records = result.scalars().all()

    items = [
        RecordDetail(
            id=r.id,
            run_id=r.run_id,
            data=json.loads(r.data),
            dedupe_key=r.dedupe_key,
            confidence=r.confidence,
            flags=json.loads(r.flags),
        )
        for r in records
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedRecords(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/records/{record_id}")
async def get_record(
    record_id: str,
    session: AsyncSession = Depends(get_session),
) -> RecordWithEvidence:
    result = await session.execute(select(Record).where(Record.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")

    evidence_result = await session.execute(
        select(RecordEvidence).where(RecordEvidence.record_id == record_id)
    )
    evidence_rows = evidence_result.scalars().all()

    evidence_details: list[EvidenceDetail] = []
    for ev in evidence_rows:
        source_url = None
        source_result = await session.execute(select(Source).where(Source.id == ev.source_id))
        source = source_result.scalar_one_or_none()
        if source:
            source_url = source.url

        evidence_details.append(
            EvidenceDetail(
                id=ev.id,
                record_id=ev.record_id,
                source_id=ev.source_id,
                snippet=ev.snippet,
                source_url=source_url,
            )
        )

    return RecordWithEvidence(
        record=RecordDetail(
            id=record.id,
            run_id=record.run_id,
            data=json.loads(record.data),
            dedupe_key=record.dedupe_key,
            confidence=record.confidence,
            flags=json.loads(record.flags),
        ),
        evidence=evidence_details,
    )
