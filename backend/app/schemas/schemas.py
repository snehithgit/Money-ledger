"""
Request/response schemas (thin Pydantic models, separate from the
SQLModel table classes in app.models).

Kept in one file deliberately: these are small, numerous, and mostly
mechanical (Create = table fields minus id/timestamps, Update = same
but all-optional, Read = table fields plus id). Splitting them into
one file per resource would add navigation overhead for no benefit
here (YAGNI applied to file layout, not just features).
"""
from __future__ import annotations

from datetime import date as date_, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import (
    AccountType,
    CommitmentStatus,
    Direction,
    Frequency,
    GoalStatus,
    RelationshipType,
    TransactionType,
)


# ---------- Accounts ----------
class AccountCreate(BaseModel):
    name: str
    account_type: AccountType
    institution: Optional[str] = None
    masked_number: Optional[str] = None
    owner: Optional[str] = None
    opening_balance: float = 0.0
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[AccountType] = None
    institution: Optional[str] = None
    masked_number: Optional[str] = None
    owner: Optional[str] = None
    opening_balance: Optional[float] = None
    is_archived: Optional[bool] = None
    notes: Optional[str] = None


# ---------- Categories ----------
class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


# ---------- Labels ----------
class LabelCreate(BaseModel):
    name: str
    color: Optional[str] = None


# ---------- Counterparties ----------
class CounterpartyCreate(BaseModel):
    display_name: str
    relationship: RelationshipType = RelationshipType.OTHER
    default_category_id: Optional[int] = None
    notes: Optional[str] = None


class CounterpartyUpdate(BaseModel):
    display_name: Optional[str] = None
    relationship: Optional[RelationshipType] = None
    default_category_id: Optional[int] = None
    notes: Optional[str] = None


class MergeCounterpartiesRequest(BaseModel):
    keep_id: int
    merge_id: int  # will be deleted; its aliases & transactions repoint to keep_id


class AddAliasRequest(BaseModel):
    raw_text: str


# ---------- Transactions ----------
class TransactionCreate(BaseModel):
    date: date_
    time: Optional[str] = None
    amount: float
    direction: Direction
    account_id: int
    raw_narration: str = ""
    raw_counterparty: str = ""
    upi_id: Optional[str] = None
    reference: Optional[str] = None
    utr: Optional[str] = None
    transaction_type: TransactionType = TransactionType.UNKNOWN
    counterparty_id: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    notes: Optional[str] = None
    label_ids: list[int] = []


class TransactionUpdate(BaseModel):
    date: Optional[date_] = None
    time: Optional[str] = None
    amount: Optional[float] = None
    direction: Optional[Direction] = None
    account_id: Optional[int] = None
    transaction_type: Optional[TransactionType] = None
    counterparty_id: Optional[int] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    notes: Optional[str] = None
    needs_review: Optional[bool] = None
    is_ignored: Optional[bool] = None
    linked_transaction_id: Optional[int] = None
    label_ids: Optional[list[int]] = None


class SplitCreate(BaseModel):
    amount: float
    category_id: Optional[int] = None
    counterparty_id: Optional[int] = None
    notes: Optional[str] = None


class SplitTransactionRequest(BaseModel):
    splits: list[SplitCreate]


# ---------- Rules ----------
class RuleCondition(BaseModel):
    field: str
    operator: str
    value: str | float | list


class RuleAction(BaseModel):
    type: str
    value: Optional[str | float] = None


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: list[RuleCondition]
    actions: list[RuleAction]
    priority: int = 100
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[list[RuleCondition]] = None
    actions: Optional[list[RuleAction]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class RuleTestRequest(BaseModel):
    conditions: list[RuleCondition]
    limit: int = 50


# ---------- Commitments ----------
class CommitmentCreate(BaseModel):
    name: str
    group_name: Optional[str] = None
    expected_amount: float
    frequency: Frequency = Frequency.MONTHLY
    due_day: Optional[int] = None
    start_date: Optional[date_] = None
    end_date: Optional[date_] = None
    category_id: Optional[int] = None
    payment_account_id: Optional[int] = None
    beneficiary_counterparty_id: Optional[int] = None
    goal_id: Optional[int] = None
    allow_partial_payment: bool = True
    allow_multiple_transactions: bool = True
    manual_contributions_allowed: bool = False
    auto_confirm: bool = False
    notes: Optional[str] = None


class CommitmentUpdate(BaseModel):
    name: Optional[str] = None
    group_name: Optional[str] = None
    expected_amount: Optional[float] = None
    frequency: Optional[Frequency] = None
    due_day: Optional[int] = None
    start_date: Optional[date_] = None
    end_date: Optional[date_] = None
    category_id: Optional[int] = None
    payment_account_id: Optional[int] = None
    beneficiary_counterparty_id: Optional[int] = None
    goal_id: Optional[int] = None
    allow_partial_payment: Optional[bool] = None
    allow_multiple_transactions: Optional[bool] = None
    manual_contributions_allowed: Optional[bool] = None
    auto_confirm: Optional[bool] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class AttachPaymentRequest(BaseModel):
    transaction_id: Optional[int] = None  # null => manual
    period: str  # "YYYY-MM"
    allocated_amount: float
    source_type: str = "phonepe"
    manual_note: Optional[str] = None


class ManualContributionRequest(BaseModel):
    period: str
    allocated_amount: float
    manual_note: Optional[str] = None


class BulkCommitmentPaymentRequest(BaseModel):
    """For a single lump-sum payment that covers several periods at once
    (e.g. a whole financial year's Sukanya contribution paid in one
    transfer instead of monthly). Spreads `total_amount` evenly across
    `periods` consecutive months starting at `start_period`, so each of
    those months shows the commitment as fulfilled instead of pending."""

    transaction_id: Optional[int] = None  # null => manual, not tied to an imported transaction
    start_period: str  # "YYYY-MM" - the first month this payment covers
    periods: int  # how many consecutive months it covers
    total_amount: float
    source_type: str = "phonepe"
    manual_note: Optional[str] = None


class CommitmentPeriodStatus(BaseModel):
    commitment_id: int
    name: str
    group_name: Optional[str]
    period: str
    expected_amount: float
    paid_amount: float
    status: CommitmentStatus
    payments: list[dict]


# ---------- Goals ----------
class GoalCreate(BaseModel):
    name: str
    target_amount: Optional[float] = None
    target_date: Optional[date_] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    target_date: Optional[date_] = None
    category_id: Optional[int] = None
    status: Optional[GoalStatus] = None
    notes: Optional[str] = None


class GoalContributionCreate(BaseModel):
    amount: float
    date: date_
    transaction_id: Optional[int] = None
    manual_note: Optional[str] = None
