"""
Shared enums for the domain model.

These are intentionally small and closed. Anything that needs to be
open-ended (categories, labels, accounts) is a user-editable table,
not an enum.
"""
from __future__ import annotations

from enum import Enum


class Direction(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class TransactionType(str, Enum):
    """What a transaction *means*, as distinct from raw debit/credit.

    This is the single most important classification in the app -
    see spec section 45: "don't classify every debit as an expense."
    """

    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"  # between the user's own accounts
    LOAN_PAYMENT = "loan_payment"
    EMI = "emi"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    FAMILY_CONTRIBUTION = "family_contribution"
    REFUND = "refund"
    CASH_WITHDRAWAL = "cash_withdrawal"
    CASH_DEPOSIT = "cash_deposit"
    INTERNAL_TRANSFER = "internal_transfer"
    UNKNOWN = "unknown_needs_review"


class AccountType(str, Enum):
    PHONEPE_WALLET = "phonepe_wallet"
    BANK_SAVINGS = "bank_savings"
    BANK_SALARY = "bank_salary"
    WIFE_ACCOUNT = "wife_account"
    CASH = "cash"
    WALLET = "wallet"
    CREDIT_CARD = "credit_card"
    RENTAL = "rental"
    LOAN = "loan"
    OTHER_BANK = "other_bank"


class RelationshipType(str, Enum):
    FAMILY = "family"
    PERSONAL_LENDING = "personal_lending"
    BUSINESS = "business"
    BANK_LENDER = "bank_lender"
    FRIEND = "friend"
    RENTAL = "rental"
    MERCHANT = "merchant"
    OTHER = "other"


class Frequency(str, Enum):
    MONTHLY = "monthly"
    WEEKLY = "weekly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class CommitmentStatus(str, Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    COMPLETED = "completed"
    OVERPAID = "overpaid"
    SKIPPED = "skipped"
    LATE = "late"
    NEEDS_REVIEW = "needs_review"


class ConditionField(str, Enum):
    COUNTERPARTY = "counterparty"
    NARRATION = "narration"
    UPI_ID = "upi_id"
    AMOUNT = "amount"
    DIRECTION = "direction"
    ACCOUNT = "account"
    DAY_OF_MONTH = "day_of_month"
    TRANSACTION_TYPE = "transaction_type"
    BANK = "bank"
    REFERENCE = "reference"


class ConditionOperator(str, Enum):
    EQUALS = "equals"
    CONTAINS = "contains"
    RANGE = "range"
    GT = "greater_than"
    LT = "less_than"


class RuleActionType(str, Enum):
    SET_CATEGORY = "set_category"
    SET_SUBCATEGORY = "set_subcategory"
    SET_LABEL = "set_label"
    SET_PERSON = "set_person"
    SET_ACCOUNT = "set_account"
    SET_TRANSACTION_TYPE = "set_transaction_type"
    ATTACH_COMMITMENT = "attach_commitment"
    ATTACH_GOAL = "attach_goal"
    MARK_TRANSFER = "mark_transfer"
    MARK_INCOME = "mark_income"
    MARK_EXPENSE = "mark_expense"
    IGNORE = "ignore"
    NEEDS_REVIEW = "needs_review"


class ImportStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
