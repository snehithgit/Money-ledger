from __future__ import annotations

from typing import Generator

from sqlmodel import Session

from app.core import db


def get_session() -> Generator[Session, None, None]:
    # Reference app.core.db.engine dynamically (not via a top-level
    # `from ... import engine`) so tests can swap in an in-memory
    # SQLite engine by monkeypatching app.core.db.engine.
    with Session(db.engine) as session:
        yield session
