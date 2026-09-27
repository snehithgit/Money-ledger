from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import ImportStatus


class ImportBatch(SQLModel, table=True):
    """One import run's history/summary (spec sections 14 & 48).

    The raw uploaded file is archived to disk (see core/config.py
    raw_imports_dir) and never deleted, so an import can always be
    traced back to its exact source bytes.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    archived_path: Optional[str] = None
    account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    imported_at: datetime = Field(default_factory=datetime.utcnow)
    status: ImportStatus = ImportStatus.SUCCESS
    transactions_found: int = 0
    transactions_new: int = 0
    transactions_duplicate: int = 0
    transactions_failed: int = 0
    transactions_needs_review: int = 0
    error_message: Optional[str] = None
