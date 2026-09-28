from __future__ import annotations

from datetime import date as date_, datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import GoalStatus


class Goal(SQLModel, table=True):
    """A savings/investment goal (e.g. Sukanya Samriddhi).

    A goal is fed by one or more RecurringCommitments (the monthly
    contribution obligations) plus optional ad-hoc GoalContribution
    rows for one-off top-ups that aren't part of a recurring schedule.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    target_amount: Optional[float] = None  # open-ended goals may have none
    target_date: Optional[date_] = None
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    status: GoalStatus = GoalStatus.ACTIVE
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GoalContribution(SQLModel, table=True):
    """An ad-hoc contribution toward a goal, not tied to a recurring
    commitment's monthly schedule (e.g. a one-time lumpsum top-up).
    Regular monthly contributions are tracked via CommitmentPayment
    instead, joined through RecurringCommitment.goal_id, so the same
    money is never counted twice.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    goal_id: int = Field(foreign_key="goal.id", index=True)
    transaction_id: Optional[int] = Field(default=None, foreign_key="transaction.id")
    amount: float
    date: date_
    is_manual: bool = False
    manual_note: Optional[str] = None
    rule_id: Optional[int] = Field(default=None, foreign_key="rule.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
