from __future__ import annotations

from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

connect_args = {"check_same_thread": False}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    """Create all tables if they don't exist.

    This app uses a single, understandable SQLite schema. Alembic is
    included for future schema changes (see backend/alembic/), but a
    fresh install just needs the tables created once.
    """
    # Import models so they are registered on SQLModel.metadata before
    # create_all runs.
    from app.models import (  # noqa: F401
        account,
        category,
        counterparty,
        label,
        transaction,
        rule,
        commitment,
        goal,
        budget,
        importbatch,
        setting,
    )

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
