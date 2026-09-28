from __future__ import annotations

from datetime import date as date_, datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import Frequency


class RecurringCommitment(SQLModel, table=True):
    """A recurring financial obligation or contribution.

    One commitment can be satisfied by MULTIPLE transactions from
    MULTIPLE accounts/sources in the same period (e.g. the Union/Asha
    home loan arrangement: rent-funded + PhonePe + manual all count
    toward the same ₹40,000/month obligation). See CommitmentPayment.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    group_name: Optional[str] = None  # e.g. "Home / Property Finance"
    expected_amount: float
    frequency: Frequency = Frequency.MONTHLY
    due_day: Optional[int] = None  # day of month, 1-31, when frequency=MONTHLY
    start_date: Optional[date_] = None
    end_date: Optional[date_] = None
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    payment_account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    beneficiary_counterparty_id: Optional[int] = Field(default=None, foreign_key="counterparty.id")
    matching_rule_id: Optional[int] = Field(default=None, foreign_key="rule.id")
    goal_id: Optional[int] = Field(default=None, foreign_key="goal.id")
    allow_partial_payment: bool = True
    allow_multiple_transactions: bool = True
    manual_contributions_allowed: bool = False
    # When true, this commitment never needs a manual "confirm" click:
    # any past-or-current period with no recorded payment is treated as
    # automatically fulfilled (see calculate_commitment_status) - for
    # obligations that happen outside PhonePe on a reliable schedule
    # (e.g. an auto-debit from someone else's account) where a manual
    # confirmation step is just friction, not a real check.
    auto_confirm: bool = False
    active: bool = True
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CommitmentPayment(SQLModel, table=True):
    """One contribution toward one commitment for one period.

    `transaction_id` is nullable to support manually-confirmed
    contributions that never appear in an imported statement (e.g. the
    wife's ₹1,000/month Sukanya contribution, auto-deducted from her
    own account). `source_type` records where the money came from so
    dashboards can answer "how much of the home loan payment came from
    rent vs. PhonePe vs. other" without double-counting.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    commitment_id: int = Field(foreign_key="recurringcommitment.id", index=True)
    transaction_id: Optional[int] = Field(default=None, foreign_key="transaction.id", index=True)
    period: str = Field(index=True)  # "YYYY-MM" for monthly commitments
    allocated_amount: float
    source_type: str = "phonepe"  # "phonepe" | "rent" | "manual" | "other"
    is_manual: bool = False
    manual_note: Optional[str] = None
    rule_id: Optional[int] = Field(default=None, foreign_key="rule.id", index=True)
    paid_date: Optional[date_] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
