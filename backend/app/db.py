import logging
from collections.abc import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.config import settings

logger = logging.getLogger(__name__)

_db_url = settings.database_url
if _db_url.startswith("sqlite:///"):
    _db_url = _db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)

connect_args = {"timeout": 30.0} if "sqlite" in _db_url else {}
engine = create_async_engine(_db_url, echo=False, connect_args=connect_args)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
    """Enforce foreign keys and 30s busy timeout for SQLite concurrency."""
    if "sqlite" in _db_url:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 30000")
        cursor.close()


# Additive column migrations: (table, column, sql_type, default)
_MIGRATIONS: list[tuple[str, str, str, str]] = [
    ("runs", "run_spec", "TEXT", "'{}'"),
    ("run_events", "data", "TEXT", "NULL"),
]


async def _apply_migrations(conn) -> None:  # noqa: ANN001
    """Add missing columns without Alembic. Safe to re-run."""
    for table, column, sql_type, default in _MIGRATIONS:
        try:
            await conn.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
        except Exception:
            stmt = f"ALTER TABLE {table} ADD COLUMN {column} {sql_type} DEFAULT {default}"
            await conn.execute(text(stmt))
            logger.info("Migration: added %s.%s", table, column)


async def create_all() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await _apply_migrations(conn)
        # Enable WAL mode, foreign keys, and busy timeout for concurrent reads and writes
        if "sqlite" in _db_url:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))
            await conn.execute(text("PRAGMA busy_timeout=30000"))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
