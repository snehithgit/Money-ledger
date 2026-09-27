from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Setting(SQLModel, table=True):
    """Simple key-value store for app-level settings (e.g. PIN hash in
    a future phase). Kept generic so we don't need a migration every
    time a new toggle is added.
    """

    key: str = Field(primary_key=True)
    value: Optional[str] = None
