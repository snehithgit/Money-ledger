from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Label(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    color: Optional[str] = None


class TransactionLabel(SQLModel, table=True):
    """Many-to-many link between transactions and labels."""

    transaction_id: int = Field(foreign_key="transaction.id", primary_key=True)
    label_id: int = Field(foreign_key="label.id", primary_key=True)
