from __future__ import annotations

import os
import tempfile

# Point the app at a throwaway data directory BEFORE any app module is
# imported (app.core.config builds its paths at import time).
_tmp_data_dir = tempfile.mkdtemp(prefix="finance_test_data_")
os.environ["FINANCE_DATA_DIR"] = _tmp_data_dir

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402

from app.core import db as db_module  # noqa: E402
from app.core.config import settings  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path):
    """Every test gets its own throwaway data_dir (so raw-import
    archives from one test never leak into another's assertions)."""
    original = settings.data_dir
    settings.data_dir = tmp_path / "finance_data"
    settings.raw_imports_dir.mkdir(parents=True, exist_ok=True)
    try:
        yield
    finally:
        settings.data_dir = original


@pytest.fixture()
def session():
    """A fresh in-memory SQLite database per test, with all tables
    created and app.core.db.engine swapped to point at it so every
    part of the app (API routes, services) transparently uses it."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    # Import every model so SQLModel.metadata knows about all tables.
    from app.models import account, budget, category, commitment, counterparty, goal, importbatch, label, rule, setting, transaction  # noqa: F401

    SQLModel.metadata.create_all(engine)

    original_engine = db_module.engine
    db_module.engine = engine
    try:
        with Session(engine) as s:
            yield s
    finally:
        db_module.engine = original_engine


@pytest.fixture()
def client(session):
    from app.main import app

    with TestClient(app) as c:
        yield c
