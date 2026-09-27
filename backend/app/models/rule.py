from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON

from app.models.enums import RuleActionType


class Rule(SQLModel, table=True):
    """A deterministic categorization rule.

    Conditions and actions are stored as JSON lists so the schema
    doesn't need a migration every time a new condition field is
    added, while stay(ing) fully deterministic and explainable - no
    ML, no confidence scores, just "these conditions matched, so this
    action fired" (spec sections 8 & 45).

    conditions: list of {field, operator, value} - ALL must match (AND).
    actions: list of {type, value}
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    conditions: list = Field(sa_column=Column(JSON), default_factory=list)
    actions: list = Field(sa_column=Column(JSON), default_factory=list)
    priority: int = 100  # lower runs first
    is_active: bool = True
    matched_count: int = 0  # denormalized counter, refreshed on run/test
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
