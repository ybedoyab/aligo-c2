"""Pytest fixtures. Environment is configured BEFORE importing app modules."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Generator

# Configure a throwaway DB and disable the ledger chain before app import.
_TMP_DB = os.path.join(tempfile.gettempdir(), "aligo_test_c2.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ["LEDGER_ENABLED"] = "false"
os.environ["NODE_SHARED_TOKEN"] = "test-token"

import pytest  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

from app.db.database import engine, init_db  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db() -> Generator[None, None, None]:
    """Reset all tables before each test for isolation."""
    SQLModel.metadata.drop_all(engine)
    init_db()
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def session() -> Generator[Session, None, None]:
    with Session(engine) as s:
        yield s
