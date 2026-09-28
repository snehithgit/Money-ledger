from __future__ import annotations

from datetime import date as date_, datetime
from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.enums import Direction, TransactionType


class Transaction(SQLModel, table=True):
    """The normalized internal transaction record (spec section 13).

    Raw imported data is never overwritten: `raw_narration`, `raw_row`,
    `source`, and `source_file` preserve exactly what the statement
    said, forever - even after the user re-categorizes, re-labels, or
    a rule changes its mind. Everything derived (category, type,
    counterparty, commitment linkage) lives in separate, editable
    columns/tables layered on top.
    """

    id: Optional[int] = Field(default=None, primary_key=True)

    # --- Facts, as imported (never mutated after import) ---
    date: date_ = Field(index=True)
    time: Optional[str] = None  # "HH:MM", display only
    amount: float
    direction: Direction
    raw_narration: str  # exact "Transaction Details" text
    raw_counterparty: str  # narration with "Paid to " / "Received from " stripped
    upi_id: Optional[str] = None
    reference: str = Field(index=True)  # PhonePe "Transaction ID"
    utr: Optional[str] = None
    raw_instrument: Optional[str] = None  # "Credit/debit instrument" as seen
    source: str = "manual"  # "phonepe_csv", "manual", future: "bank_csv"
    source_file: Optional[str] = None
    import_batch_id: Optional[int] = Field(default=None, foreign_key="importbatch.id", index=True)
    fingerprint: str = Field(index=True, unique=True)  # de-dup key, see importers/dedup.py

    # --- Derived / user-editable classification ---
    account_id: int = Field(foreign_key="account.id", index=True)
    transaction_type: TransactionType = TransactionType.UNKNOWN
    counterparty_id: Optional[int] = Field(default=None, foreign_key="counterparty.id", index=True)
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    subcategory_id: Optional[int] = Field(default=None, foreign_key="category.id")
    notes: Optional[str] = None

    # --- Internal transfer linkage (transfer between the user's own accounts) ---
    linked_transaction_id: Optional[int] = Field(default=None, foreign_key="transaction.id")

    # --- Review / explainability ---
    needs_review: bool = True
    review_reason: Optional[str] = None
    matched_rule_id: Optional[int] = Field(default=None, foreign_key="rule.id")
    match_explanation: Optional[str] = None  # human-readable "why" for auto-classification
    is_ignored: bool = False  # e.g. wallet cashback dust the user chooses to hide

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TransactionSplit(SQLModel, table=True):
    """Splits one transaction across multiple categories/people.

    Invariant enforced in the service layer (never trust the DB alone):
    sum(splits.amount) for a transaction must always equal the parent
    transaction's amount (spec section 47 test).
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    transaction_id: int = Field(foreign_key="transaction.id", index=True)
    amount: float
    category_id: Optional[int] = Field(default=None, foreign_key="category.id")
    counterparty_id: Optional[int] = Field(default=None, foreign_key="counterparty.id")
    notes: Optional[str] = None
