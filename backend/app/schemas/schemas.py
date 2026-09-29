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
from typing import Optional, Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from decimal import Decimal, ROUND_HALF_UP

from app.models.enums import (
    AccountType,
    CommitmentStatus,
    Direction,
    Frequency,
    GoalStatus,
    RelationshipType,
    TransactionType,
)




def _money(v: float) -> float:
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

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
    amount: float = Field(gt=0)
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

    @field_validator("amount")
    @classmethod
    def cents(cls, v): return _money(v)


class TransactionUpdate(BaseModel):
    date: Optional[date_] = None
    time: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
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
    amount: float = Field(gt=0)

    @field_validator("amount")
    @classmethod
    def cents(cls, v): return _money(v)
    category_id: Optional[int] = None
    counterparty_id: Optional[int] = None
    notes: Optional[str] = None


class SplitTransactionRequest(BaseModel):
    splits: list[SplitCreate] = Field(min_length=2)


class TransferCreate(BaseModel):
    date: date_
    amount: float = Field(gt=0)
    source_account_id: int
    destination_account_id: int
    notes: Optional[str] = None


# ---------- Rules ----------
class RuleCondition(BaseModel):
    field: str
    operator: str
    value: str | float | list

    @field_validator("field")
    @classmethod
    def valid_field(cls, v):
        from app.models.enums import ConditionField
        if v not in {x.value for x in ConditionField}: raise ValueError("unsupported rule field")
        return v

    @field_validator("operator")
    @classmethod
    def valid_operator(cls, v):
        from app.models.enums import ConditionOperator
        if v not in {x.value for x in ConditionOperator}: raise ValueError("unsupported rule operator")
        return v

    @model_validator(mode="after")
    def valid_value(self):
        if self.operator in {"contains", "word_contains"} and (not isinstance(self.value, str) or not self.value.strip()):
            raise ValueError(f"{self.operator} requires a non-empty string")
        if self.operator == "range" and (not isinstance(self.value, list) or len(self.value) != 2):
            raise ValueError("range requires exactly two values")
        return self


class RuleAction(BaseModel):
    type: str
    value: Optional[str | float] = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, v):
        from app.models.enums import RuleActionType
        if v not in {x.value for x in RuleActionType}: raise ValueError("unsupported rule action")
        return v


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: list[RuleCondition] = Field(min_length=1)
    actions: list[RuleAction] = Field(min_length=1)
    priority: int = 30
    is_active: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[list[RuleCondition]] = None
    actions: Optional[list[RuleAction]] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("conditions")
    @classmethod
    def nonempty_conditions(cls, v):
        if v is not None and not v: raise ValueError("conditions cannot be empty")
        return v

    @field_validator("actions")
    @classmethod
    def nonempty_actions(cls, v):
        if v is not None and not v: raise ValueError("actions cannot be empty")
        return v


class RuleTestRequest(BaseModel):
    conditions: list[RuleCondition] = Field(min_length=1)
    limit: int = Field(default=50, ge=1, le=500)


# ---------- Commitments ----------
class CommitmentCreate(BaseModel):
    name: str
    group_name: Optional[str] = None
    expected_amount: float = Field(gt=0)
    frequency: Frequency = Frequency.MONTHLY
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
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
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
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
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    allocated_amount: float = Field(gt=0)
    source_type: Literal["phonepe", "rent", "manual", "other"] = "phonepe"
    manual_note: Optional[str] = None
    paid_date: Optional[date_] = None


class ManualContributionRequest(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    allocated_amount: float = Field(gt=0)
    manual_note: Optional[str] = None
    paid_date: Optional[date_] = None


class BulkCommitmentPaymentRequest(BaseModel):
    """For a single lump-sum payment that covers several periods at once
    (e.g. a whole financial year's Sukanya contribution paid in one
    transfer instead of monthly). Spreads `total_amount` evenly across
    `periods` consecutive months starting at `start_period`, so each of
    those months shows the commitment as fulfilled instead of pending."""

    transaction_id: Optional[int] = None  # null => manual, not tied to an imported transaction
    start_period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")  # first month
    periods: int = Field(ge=1, le=120)  # how many consecutive months it covers
    total_amount: float = Field(gt=0)
    source_type: Literal["phonepe", "rent", "manual", "other"] = "phonepe"
    manual_note: Optional[str] = None
    paid_date: Optional[date_] = None


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
    amount: float = Field(gt=0)
    date: date_
    transaction_id: Optional[int] = None
    manual_note: Optional[str] = None
