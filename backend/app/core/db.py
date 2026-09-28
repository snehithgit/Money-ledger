from __future__ import annotations

from sqlalchemy import event, inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import SQLModel, Session, create_engine

from app.core.config import settings

connect_args = {"check_same_thread": False}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


@event.listens_for(Engine, "connect")
def _sqlite_foreign_keys(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _add_missing_columns() -> None:
    """Small additive compatibility bridge for pre-Alembic databases.

    Existing installations were previously initialized with create_all(),
    which cannot add new columns. Keep upgrades non-destructive while the
    formal Alembic migration remains the canonical schema history.
    """
    inspector = inspect(engine)
    additions = {
        "transaction": [("classification_source", "VARCHAR NOT NULL DEFAULT 'unclassified'")],
        "transactionlabel": [("rule_id", "INTEGER REFERENCES rule(id)")],
        "commitmentpayment": [("rule_id", "INTEGER REFERENCES rule(id)")],
        "goalcontribution": [("rule_id", "INTEGER REFERENCES rule(id)")],
        "recurringcommitment": [("auto_confirm", "BOOLEAN NOT NULL DEFAULT 0")],
    }
    with engine.begin() as conn:
        for table, cols in additions.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{name}" {ddl}'))
        if inspector.has_table("transaction"):
            conn.execute(text("""UPDATE "transaction" SET classification_source = CASE WHEN matched_rule_id IS NOT NULL THEN 'rule' WHEN needs_review = 0 THEN 'manual' ELSE 'unclassified' END WHERE classification_source = 'unclassified'"""))


def init_db() -> None:
    from app.models import (  # noqa: F401
        account, category, counterparty, label, transaction, rule, commitment,
        goal, budget, importbatch, setting,
    )
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def get_session():
    with Session(engine) as session:
        yield session
