from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import RelationshipType


class Counterparty(SQLModel, table=True):
    """A real-world person, business, or bank the user transacts with.

    One counterparty can have many raw-name aliases (see
    CounterpartyAlias) - real statements spell the same person's name
    differently ("Chinthapalli Sambasiva" vs "CHINTHA PALLI SAMBASIVA").
    Merging aliases is always a manual, explicit user action - never
    automatic based on string similarity (spec section 45).
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    display_name: str = Field(index=True)
    relationship: RelationshipType = RelationshipType.OTHER
    default_category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CounterpartyAlias(SQLModel, table=True):
    """A raw counterparty string (as seen in a statement) mapped to a
    canonical Counterparty. Created automatically on first sight
    (pointing at a new, unconfirmed Counterparty) and repointed only by
    explicit user merge actions.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    raw_text: str = Field(index=True, unique=True)
    counterparty_id: int = Field(foreign_key="counterparty.id", index=True)
