"""Database engine and session management (SQLite by default, Postgres-ready)."""

from __future__ import annotations

from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

# SQLite needs check_same_thread=False because FastAPI uses multiple threads.
_connect_args: dict = {}
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,
)


def init_db() -> None:
    """Create all tables. Importing models registers them on SQLModel.metadata."""
    # Imported for side effects: registers tables on the shared metadata.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session
