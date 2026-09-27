from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import AccountType


class Account(SQLModel, table=True):
    """A place money lives or moves through.

    Transfers between two rows in this table are TRANSFER transactions,
    never income or expense (spec section 10 / section 45).
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    account_type: AccountType
    institution: Optional[str] = None  # e.g. "PhonePe", "Union Bank"
    masked_number: Optional[str] = None  # e.g. "XXXXXXXXXX1372"
    owner: Optional[str] = None  # e.g. "self", "wife" - for family accounts
    opening_balance: float = 0.0
    is_archived: bool = False
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
