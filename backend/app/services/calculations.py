"""
Centralized financial calculations (spec section 40: one place for
every derived number, never duplicated in a UI component).

Classification -> bucket mapping, used everywhere in this module:

  * INCOME, REFUND            -> counts as money IN.
  * EXPENSE                   -> counts as money OUT, and is the ONLY
                                  bucket that appears in category
                                  spending breakdowns / charts.
  * LOAN_PAYMENT, EMI, SAVINGS,
    INVESTMENT, FAMILY_CONTRIBUTION
                               -> counts as money OUT for net cash
                                  flow, but is reported in its OWN
                                  totals, never folded into "Expense"
                                  (spec section 45: never mix Sukanya
                                  investment with discretionary
                                  spending).
  * TRANSFER, INTERNAL_TRANSFER,
    CASH_WITHDRAWAL, CASH_DEPOSIT
                               -> excluded entirely from income/expense
                                  totals. Moving money between your own
                                  pools is neither income nor expense
                                  (spec section 45's single most
                                  repeated rule).
  * UNKNOWN                    -> excluded from every total until
                                  classified. An un-reviewed
                                  transaction should never silently
                                  inflate or deflate a number the user
                                  is trusting.

`is_ignored` transactions are excluded from every report total below,
but still count toward account balance (they're still real money that
moved - just noise the user chose to hide from reports).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date as date_

from sqlmodel import Session, select

from app.models.account import Account
from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.models.enums import CommitmentStatus, Direction, TransactionType
from app.models.goal import Goal, GoalContribution
from app.models.transaction import Transaction

MONEY_IN_TYPES = {TransactionType.INCOME, TransactionType.REFUND}
MONEY_OUT_TYPES = {
    TransactionType.EXPENSE,
    TransactionType.LOAN_PAYMENT,
    TransactionType.EMI,
    TransactionType.SAVINGS,
    TransactionType.INVESTMENT,
    TransactionType.FAMILY_CONTRIBUTION,
}
EXCLUDED_TYPES = {
    TransactionType.TRANSFER,
    TransactionType.INTERNAL_TRANSFER,
    TransactionType.CASH_WITHDRAWAL,
    TransactionType.CASH_DEPOSIT,
}


def _month_range(year: int, month: int) -> tuple[date_, date_]:
    start = date_(year, month, 1)
    end = date_(year + 1, 1, 1) if month == 12 else date_(year, month + 1, 1)
    return start, end


def _transactions_in_range(session: Session, start: date_, end: date_, account_id: int | None = None) -> list[Transaction]:
    stmt = select(Transaction).where(
        Transaction.date >= start, Transaction.date < end, Transaction.is_ignored == False  # noqa: E712
    )
    if account_id is not None:
        stmt = stmt.where(Transaction.account_id == account_id)
    return session.exec(stmt).all()


def calculate_cashflow(session: Session, start: date_, end: date_, account_id: int | None = None) -> dict:
    txns = _transactions_in_range(session, start, end, account_id)
    money_in = sum(t.amount for t in txns if t.transaction_type in MONEY_IN_TYPES)
    money_out = sum(t.amount for t in txns if t.transaction_type in MONEY_OUT_TYPES)
    by_out_type: dict[str, float] = defaultdict(float)
    for t in txns:
        if t.transaction_type in MONEY_OUT_TYPES:
            by_out_type[t.transaction_type.value] += t.amount
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "money_in": round(money_in, 2),
        "money_out": round(money_out, 2),
        "net": round(money_in - money_out, 2),
        "by_out_type": dict(by_out_type),
        "excluded_transfer_total": round(
            sum(t.amount for t in txns if t.transaction_type in EXCLUDED_TYPES), 2
        ),
        "unclassified_count": sum(1 for t in txns if t.transaction_type == TransactionType.UNKNOWN),
    }


def calculate_month_summary(session: Session, year: int, month: int, account_id: int | None = None) -> dict:
    start, end = _month_range(year, month)
    summary = calculate_cashflow(session, start, end, account_id)
    summary["year"] = year
    summary["month"] = month
    return summary


def calculate_category_spend(session: Session, start: date_, end: date_) -> list[dict]:
    """Spend by category - EXPENSE transactions only, per the module
    docstring. Savings/EMI/investment intentionally never appear here."""
    from app.models.category import Category

    txns = _transactions_in_range(session, start, end)
    totals: dict[int | None, float] = defaultdict(float)
    for t in txns:
        if t.transaction_type == TransactionType.EXPENSE:
            totals[t.category_id] += t.amount

    out = []
    for cat_id, amount in sorted(totals.items(), key=lambda kv: -kv[1]):
        cat = session.get(Category, cat_id) if cat_id else None
        out.append({"category_id": cat_id, "category_name": cat.name if cat else "Uncategorized", "amount": round(amount, 2)})
    return out


def calculate_account_balance(session: Session, account_id: int) -> float:
    account = session.get(Account, account_id)
    if not account:
        raise ValueError("account not found")
    txns = session.exec(select(Transaction).where(Transaction.account_id == account_id)).all()
    balance = account.opening_balance
    for t in txns:
        balance += t.amount if t.direction == Direction.CREDIT else -t.amount
    return round(balance, 2)


def calculate_commitment_status(session: Session, commitment_id: int, period: str) -> dict:
    """Status for one commitment in one "YYYY-MM" period.

    A commitment can be satisfied by many payments from many sources
    (spec section 5/6): sum every CommitmentPayment for this
    commitment+period, regardless of source_type, and compare to
    expected_amount.
    """
    commitment = session.get(RecurringCommitment, commitment_id)
    if not commitment:
        raise ValueError("commitment not found")

    payments = session.exec(
        select(CommitmentPayment).where(
            CommitmentPayment.commitment_id == commitment_id, CommitmentPayment.period == period
        )
    ).all()
    paid = sum(p.allocated_amount for p in payments)

    if paid <= 0:
        status = CommitmentStatus.PENDING
    elif abs(paid - commitment.expected_amount) < 0.01:
        status = CommitmentStatus.COMPLETED
    elif paid < commitment.expected_amount:
        status = CommitmentStatus.PARTIAL if commitment.allow_partial_payment else CommitmentStatus.NEEDS_REVIEW
    else:
        status = CommitmentStatus.OVERPAID

    return {
        "commitment_id": commitment_id,
        "name": commitment.name,
        "group_name": commitment.group_name,
        "period": period,
        "expected_amount": commitment.expected_amount,
        "paid_amount": round(paid, 2),
        "status": status,
        "payments": [
            {
                "id": p.id,
                "transaction_id": p.transaction_id,
                "allocated_amount": p.allocated_amount,
                "source_type": p.source_type,
                "is_manual": p.is_manual,
                "manual_note": p.manual_note,
            }
            for p in payments
        ],
    }


def calculate_goal_progress(session: Session, goal_id: int) -> dict:
    """Total progress toward a goal = every CommitmentPayment made
    against a commitment linked to this goal, PLUS any ad-hoc
    GoalContribution rows. Never double counted: a commitment's
    payments are only summed here via the commitment->goal link, and
    GoalContribution is reserved for contributions that are NOT part
    of a recurring commitment's schedule.
    """
    goal = session.get(Goal, goal_id)
    if not goal:
        raise ValueError("goal not found")

    commitments = session.exec(select(RecurringCommitment).where(RecurringCommitment.goal_id == goal_id)).all()
    total_from_commitments = 0.0
    breakdown = []
    for c in commitments:
        payments = session.exec(select(CommitmentPayment).where(CommitmentPayment.commitment_id == c.id)).all()
        subtotal = sum(p.allocated_amount for p in payments)
        total_from_commitments += subtotal
        breakdown.append({"commitment_id": c.id, "commitment_name": c.name, "total": round(subtotal, 2)})

    adhoc = session.exec(select(GoalContribution).where(GoalContribution.goal_id == goal_id)).all()
    total_adhoc = sum(a.amount for a in adhoc)

    total = total_from_commitments + total_adhoc
    return {
        "goal_id": goal_id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "total_contributed": round(total, 2),
        "remaining": round(goal.target_amount - total, 2) if goal.target_amount else None,
        "by_commitment": breakdown,
        "adhoc_total": round(total_adhoc, 2),
    }
