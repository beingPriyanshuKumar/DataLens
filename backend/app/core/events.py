import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session
from app.models import EventLevel, RunEvent

logger = logging.getLogger(__name__)


async def emit(
    run_id: str,
    level: EventLevel,
    step: str,
    message: str,
    session: AsyncSession | None = None,
) -> None:
    """Persist a run event. Creates its own session if none provided."""
    event = RunEvent(run_id=run_id, level=level, step=step, message=message)

    if session is not None:
        session.add(event)
        await session.commit()
        return

    async with async_session() as s:
        s.add(event)
        await s.commit()

    logger.info("[%s] %s/%s: %s", level.value, run_id[:8], step, message)
