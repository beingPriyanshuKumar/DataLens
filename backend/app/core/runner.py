from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import UTC, datetime
from urllib.parse import urlparse

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.fetcher import FetchError, fetch_page
from app.collectors.policy import clear_robots_cache, is_allowed
from app.collectors.search import search_multiple
from app.config import settings
from app.core.events import emit
from app.db import async_session
from app.models import (
    EventLevel,
    Record,
    RecordEvidence,
    Run,
    RunStatus,
    Source,
    SourceStatus,
)
from app.processing.deduper import deduplicate
from app.processing.extractor import extract_from_page
from app.processing.normalizer import normalize_record
from app.processing.scorer import score_record
from app.processing.validator import validate_record
from app.processing.verifier import verify_records
from app.schemas import Plan, TaskSpec

logger = logging.getLogger(__name__)

_active_tasks: set[asyncio.Task] = set()


def _deterministic_id(run_id: str, dedupe_key: str) -> str:
    """Generate a deterministic record ID from run_id and dedupe_key."""
    return hashlib.sha1(f"{run_id}:{dedupe_key}".encode()).hexdigest()[:16]


async def _get_run(session: AsyncSession, run_id: str) -> Run | None:
    result = await session.execute(select(Run).where(Run.id == run_id))
    return result.scalar_one_or_none()


async def _update_run(
    run_id: str,
    *,
    status: RunStatus | None = None,
    stats: dict | None = None,
    error: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
    run_spec: str | None = None,
) -> None:
    async with async_session() as session:
        run = await _get_run(session, run_id)
        if run is None:
            return
        if status is not None:
            run.status = status
        if stats is not None:
            run.stats = json.dumps(stats)
        if error is not None:
            run.error = error
        if started_at is not None:
            run.started_at = started_at
        if finished_at is not None:
            run.finished_at = finished_at
        if run_spec is not None:
            run.run_spec = run_spec
        session.add(run)
        await session.commit()


async def _is_cancelled(run_id: str) -> bool:
    async with async_session() as session:
        run = await _get_run(session, run_id)
        return run is not None and run.status == RunStatus.CANCELLING


async def _replace_run_records(
    run_id: str,
    deduped: list[dict],
    total_fields: int,
) -> int:
    """Replace all records for a run in one transaction. Returns the new count."""
    async with async_session() as session:
        # Delete existing records and their evidence for this run
        existing = await session.execute(select(Record.id).where(Record.run_id == run_id))
        existing_ids = [r[0] for r in existing.all()]
        if existing_ids:
            await session.execute(
                delete(RecordEvidence).where(RecordEvidence.record_id.in_(existing_ids))
            )
            await session.execute(delete(Record).where(Record.run_id == run_id))

        # Insert the new set
        for rec in deduped:
            flags = rec.pop("_flags", [])
            evidence_list = rec.pop("_evidence_list", [])
            source_ids = rec.pop("_source_ids", [])
            dedupe_key = rec.pop("_dedupe_key", "")
            rec.pop("evidence", None)
            rec.pop("_source_id", None)

            confidence = score_record(rec, total_fields, flags)
            record_id = _deterministic_id(run_id, dedupe_key)

            db_record = Record(
                id=record_id,
                run_id=run_id,
                data=json.dumps(rec),
                dedupe_key=dedupe_key,
                confidence=confidence,
                flags=json.dumps(flags),
            )
            session.add(db_record)
            await session.flush()

            for snippet, sid in zip(evidence_list, source_ids, strict=False):
                if snippet and sid:
                    evidence = RecordEvidence(
                        record_id=db_record.id,
                        source_id=sid,
                        snippet=snippet,
                    )
                    session.add(evidence)

        await session.commit()
        return len(deduped)


def _build_dataset(
    all_verified: list[dict],
    spec: TaskSpec,
) -> list[dict]:
    """Run normalize → validate → dedupe → score on the accumulated verified pool.

    Returns the deduped list with internal keys intact for persistence.
    """
    field_types = {f.name: f.type for f in spec.fields}
    valid_records: list[dict] = []
    for rec in all_verified:
        normalized, norm_flags = normalize_record(rec, field_types)
        existing_flags = list(rec.get("_flags", [])) + norm_flags
        is_valid, val_flags = validate_record(normalized, spec.fields, existing_flags)
        if is_valid:
            normalized["_flags"] = val_flags
            valid_records.append(normalized)
    deduped = deduplicate(valid_records, spec.key_fields)
    return deduped


_run_semaphore: asyncio.Semaphore | None = None


def _get_run_semaphore() -> asyncio.Semaphore:
    global _run_semaphore
    if _run_semaphore is None:
        _run_semaphore = asyncio.Semaphore(settings.max_concurrent_runs)
    return _run_semaphore


async def execute_run(run_id: str) -> None:
    """Execute the full pipeline for a run with live streaming of results."""
    clear_robots_cache()
    run_start_time = time.monotonic()
    first_record_time: float | None = None

    try:
        if await _is_cancelled(run_id):
            await _update_run(run_id, status=RunStatus.CANCELLED, finished_at=datetime.now(UTC))
            await emit(run_id, EventLevel.INFO, "cancel", "Run cancelled before start")
            return

        # Acquire concurrency slot (PERF-001 / F-04)
        await emit(run_id, EventLevel.INFO, "queue", "Queued: waiting for a free slot")
        sem = _get_run_semaphore()

        async with sem:
            if await _is_cancelled(run_id):
                await _update_run(run_id, status=RunStatus.CANCELLED, finished_at=datetime.now(UTC))
                await emit(run_id, EventLevel.INFO, "cancel", "Run cancelled before start")
                return

            await _update_run(run_id, status=RunStatus.RUNNING, started_at=datetime.now(UTC))
            await emit(run_id, EventLevel.INFO, "start", "Run started")

            # Load run and task details, snapshot the spec
            async with async_session() as session:
                from app.models import Task

                run = await _get_run(session, run_id)
                if run is None:
                    return
                result = await session.execute(select(Task).where(Task.id == run.task_id))
                task = result.scalar_one_or_none()
                if task is None:
                    await _update_run(run_id, status=RunStatus.FAILED, error="Task not found")
                    return
                spec = TaskSpec.model_validate_json(task.spec)
                plan = Plan.model_validate_json(run.plan)

            # Snapshot the spec on the run for column stability
            await _update_run(run_id, run_spec=spec.model_dump_json())

            pipeline_stats: dict = {
                "raw_count": 0,
                "verified_count": 0,
                "valid_count": 0,
                "deduped_count": 0,
                "pages_fetched": 0,
                "pages_failed": 0,
                "hallucinated_count": 0,
                "fields_nulled": 0,
                "dropped_reasons": {},
            }

            # Step 1: Search
            await emit(run_id, EventLevel.INFO, "search", f"Searching with {len(plan.queries)} queries")
            search_results = await search_multiple(
                plan.queries, limit_per_query=10, region=spec.region
            )
            await emit(run_id, EventLevel.INFO, "search", f"Found {len(search_results)} candidate URLs")

        if await _is_cancelled(run_id):
            await _update_run(run_id, status=RunStatus.CANCELLED, finished_at=datetime.now(UTC))
            await emit(run_id, EventLevel.INFO, "cancel", "Run cancelled")
            return

        # Step 2: Policy filter + Fetch + Extract (with live streaming)
        all_verified_records: list[dict] = []
        pages_processed = 0
        total_fields = len(spec.fields)
        warned_currency_mismatch = False
        candidate_queue = list(search_results)
        seen_urls = {sr.url for sr in search_results}
        wave2_triggered = False

        candidate_idx = 0
        while candidate_idx < len(candidate_queue):
            sr = candidate_queue[candidate_idx]
            candidate_idx += 1

            if pages_processed >= plan.max_pages:
                break
            if await _is_cancelled(run_id):
                await _update_run(run_id, status=RunStatus.CANCELLED, finished_at=datetime.now(UTC))
                await emit(run_id, EventLevel.INFO, "cancel", "Run cancelled")
                return

            # Policy check
            decision = await is_allowed(sr.url)
            if not decision.allowed:
                source_status = (
                    SourceStatus.BLOCKED_BY_ROBOTS
                    if "robots" in decision.reason.lower()
                    else SourceStatus.BLOCKED_BY_POLICY
                )
                reason_key = source_status.value
                pipeline_stats["dropped_reasons"][reason_key] = (
                    pipeline_stats["dropped_reasons"].get(reason_key, 0) + 1
                )
                async with async_session() as session:
                    source = Source(
                        run_id=run_id,
                        url=sr.url,
                        domain=urlparse(sr.url).hostname or "",
                        status=source_status,
                        reason=decision.reason,
                    )
                    session.add(source)
                    await session.commit()
                await emit(
                    run_id, EventLevel.WARN, "policy", f"Blocked: {sr.url} — {decision.reason}"
                )
                continue

            # Fetch
            result = await fetch_page(sr.url)

            if isinstance(result, FetchError):
                # Provider-supplied fallback if technical failure occurred
                if sr.snippet and len(sr.snippet.strip()) >= 50:
                    await emit(
                        run_id,
                        EventLevel.INFO,
                        "fetch",
                        f"Direct fetch failed ({result.reason}); using provider snippet for {sr.url}",
                    )
                    source_status = SourceStatus.VIA_SEARCH_PROVIDER
                    page_text = sr.snippet.strip()
                    page_url = sr.url
                else:
                    pipeline_stats["pages_failed"] += 1
                    pipeline_stats["dropped_reasons"]["fetch_failed"] = (
                        pipeline_stats["dropped_reasons"].get("fetch_failed", 0) + 1
                    )
                    async with async_session() as session:
                        source = Source(
                            run_id=run_id,
                            url=sr.url,
                            domain=result.domain,
                            status=SourceStatus.FAILED,
                            http_status=result.http_status,
                            reason=result.reason,
                        )
                        session.add(source)
                        await session.commit()
                    await emit(
                        run_id, EventLevel.WARN, "fetch", f"Failed: {sr.url} — {result.reason}"
                    )
                    continue
            else:
                source_status = SourceStatus.FETCHED
                page_text = result.text
                page_url = result.url
                pipeline_stats["pages_fetched"] += 1
                await emit(run_id, EventLevel.INFO, "fetch", f"Fetched: {sr.url}")

            pages_processed += 1

            # Extract
            try:
                raw_records = await extract_from_page(page_text, page_url, spec)
            except Exception as exc:
                await emit(
                    run_id, EventLevel.ERROR, "extract", f"Extraction error for {sr.url}: {exc}"
                )
                raw_records = []

            pipeline_stats["raw_count"] += len(raw_records)

            # Verify evidence and field-level grounding
            field_types = {f.name: f.type for f in spec.fields}
            verified, hallucinated, fields_nulled = verify_records(
                raw_records, page_text, page_url, field_types=field_types
            )
            pipeline_stats["hallucinated_count"] += hallucinated
            pipeline_stats["verified_count"] += len(verified)
            pipeline_stats["fields_nulled"] = (
                pipeline_stats.get("fields_nulled", 0) + fields_nulled
            )
            if hallucinated > 0:
                pipeline_stats["dropped_reasons"]["evidence_mismatch"] = (
                    pipeline_stats["dropped_reasons"].get("evidence_mismatch", 0) + hallucinated
                )

            # Save source
            async with async_session() as session:
                source = Source(
                    run_id=run_id,
                    url=sr.url,
                    domain=urlparse(sr.url).hostname or "",
                    status=source_status,
                    http_status=getattr(result, "http_status", 200),
                    records_found=len(verified),
                )
                session.add(source)
                await session.commit()
                source_id = source.id

            for rec in verified:
                rec["_source_id"] = source_id

            all_verified_records.extend(verified)

            if len(raw_records) > 0:
                await emit(
                    run_id,
                    EventLevel.INFO,
                    "extract",
                    f"Extracted {len(raw_records)} raw, {len(verified)} verified from {sr.url}",
                )

            # Live streaming: rebuild the full dataset and replace records
            if len(all_verified_records) > 0:
                # Deep-copy to avoid mutating the accumulated pool
                pool_copy = [dict(r) for r in all_verified_records]
                deduped_snapshot = _build_dataset(pool_copy, spec)

                # Warn if any currency mismatches detected
                cm_count = sum(
                    1
                    for r in pool_copy
                    if any("currency_mismatch" in f for f in r.get("_flags", []))
                )
                if cm_count > 0 and not warned_currency_mismatch:
                    await emit(
                        run_id,
                        EventLevel.WARN,
                        "normalize",
                        f"Detected {cm_count} currency mismatch(es) — nulled invalid values",
                    )
                    warned_currency_mismatch = True

                # Count validation drops for stats
                pipeline_stats["valid_count"] = len(
                    [1 for r in pool_copy if "_flags" in r or r.get("_dedupe_key")]
                )
                pipeline_stats["deduped_count"] = len(deduped_snapshot)

                # Persist the snapshot
                count = await _replace_run_records(run_id, deduped_snapshot, total_fields)

                # Track first record time
                if count > 0 and first_record_time is None:
                    first_record_time = time.monotonic() - run_start_time

                # Emit records_updated event for the frontend
                await emit(
                    run_id,
                    EventLevel.INFO,
                    "records_updated",
                    f"Live update: {count} records",
                    data={"count": count, "provisional": True},
                )

            await _update_run(run_id, stats=pipeline_stats)

            # Check target count after update
            if pipeline_stats.get("deduped_count", 0) >= spec.target_count:
                await emit(
                    run_id,
                    EventLevel.INFO,
                    "early_stop",
                    f"Target count {spec.target_count} reached",
                )
                break

            # Second search wave if yield is below target and page budget remains
            if candidate_idx == len(candidate_queue) and not wave2_triggered:
                current_yield = pipeline_stats.get("deduped_count", 0)
                if current_yield < min(10, spec.target_count) and pages_processed < plan.max_pages:
                    wave2_triggered = True
                    remaining_budget = plan.max_pages - pages_processed
                    await emit(
                        run_id,
                        EventLevel.INFO,
                        "search",
                        f"Yield shortfall ({current_yield}/{spec.target_count} records). Launching second search wave (budget: {remaining_budget} pages)...",
                    )
                    wave2_queries = [
                        f"{spec.entity} list directory 2026",
                        f"top {spec.entity} database roundup",
                        f"best {spec.entity} roundup",
                    ]
                    wave2_results = await search_multiple(
                        wave2_queries, limit_per_query=8, region=spec.region
                    )
                    new_candidates = [r for r in wave2_results if r.url not in seen_urls]
                    for r in new_candidates:
                        seen_urls.add(r.url)
                        candidate_queue.append(r)
                    if new_candidates:
                        await emit(
                            run_id,
                            EventLevel.INFO,
                            "search",
                            f"Second search wave added {len(new_candidates)} candidate URLs",
                        )

        # Final pass: rebuild the dataset one last time for consistency
        if all_verified_records:
            pool_copy = [dict(r) for r in all_verified_records]
            deduped_final = _build_dataset(pool_copy, spec)

            # Count valid records (those that passed validation)
            field_types = {f.name: f.type for f in spec.fields}
            valid_count = 0
            for rec in all_verified_records:
                _, norm_flags = normalize_record(dict(rec), field_types)
                is_valid, _ = validate_record(dict(rec), spec.fields, norm_flags)
                if is_valid:
                    valid_count += 1

            pipeline_stats["valid_count"] = valid_count
            pipeline_stats["deduped_count"] = len(deduped_final)

            # Persist final dataset
            await _replace_run_records(run_id, deduped_final, total_fields)
        else:
            pipeline_stats["valid_count"] = 0
            pipeline_stats["deduped_count"] = 0

        # Add timing stats
        if first_record_time is not None:
            pipeline_stats["first_record_seconds"] = round(first_record_time, 1)
        pipeline_stats["duration_seconds"] = round(time.monotonic() - run_start_time, 1)

        if await _is_cancelled(run_id):
            await _update_run(run_id, status=RunStatus.CANCELLED, finished_at=datetime.now(UTC))
            await emit(run_id, EventLevel.INFO, "cancel", "Run cancelled")
            return

        await _update_run(
            run_id,
            status=RunStatus.COMPLETED,
            stats=pipeline_stats,
            finished_at=datetime.now(UTC),
        )

        # Final records_updated event (non-provisional)
        await emit(
            run_id,
            EventLevel.INFO,
            "records_updated",
            f"Final: {pipeline_stats['deduped_count']} records",
            data={"count": pipeline_stats["deduped_count"], "provisional": False},
        )

        await emit(
            run_id,
            EventLevel.INFO,
            "complete",
            f"Run complete — {pipeline_stats['deduped_count']} records "
            f"(raw {pipeline_stats['raw_count']} → verified {pipeline_stats['verified_count']} "
            f"→ valid {pipeline_stats['valid_count']} → deduped {pipeline_stats['deduped_count']})",
        )

    except Exception as exc:
        logger.exception("Run %s failed", run_id)
        await _update_run(
            run_id,
            status=RunStatus.FAILED,
            error=str(exc),
            finished_at=datetime.now(UTC),
        )
        await emit(run_id, EventLevel.ERROR, "fatal", f"Run failed: {exc}")


def start_run(run_id: str) -> None:
    """Launch a run as a background asyncio task."""
    task = asyncio.create_task(execute_run(run_id))
    _active_tasks.add(task)
    task.add_done_callback(_active_tasks.discard)


async def mark_stale_runs() -> None:
    """Mark any 'running' runs from a previous process as failed."""
    async with async_session() as session:
        result = await session.execute(
            select(Run).where(Run.status.in_([RunStatus.RUNNING, RunStatus.QUEUED]))
        )
        for run in result.scalars().all():
            run.status = RunStatus.FAILED
            run.error = "Server restarted"
            session.add(run)
        await session.commit()
