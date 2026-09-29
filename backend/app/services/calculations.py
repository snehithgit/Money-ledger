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
import calendar

from sqlmodel import Session, select

from app.models.account import Account
from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.models.enums import CommitmentStatus, Direction, TransactionType
from app.models.goal import Goal, GoalContribution
from app.models.transaction import Transaction, TransactionSplit

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
        if t.transaction_type != TransactionType.EXPENSE:
            continue
        splits = session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id == t.id)).all()
        if splits:
            for split in splits:
                totals[split.category_id] += split.amount
        else:
            totals[t.category_id] += t.amount

    out = []
    for cat_id, amount in sorted(totals.items(), key=lambda kv: -kv[1]):
        cat = session.get(Category, cat_id) if cat_id else None
        out.append({"category_id": cat_id, "category_name": cat.name if cat else "Uncategorized", "amount": round(amount, 2)})
    return out


def calculate_money_calendar(session: Session, year: int, month: int) -> dict:
    """Return a truthful month calendar of *all* money movement.

    ``debit_total`` / ``credit_total`` are raw statement movement, so the
    calendar never hides an unclassified transaction.  ``spend_total`` and
    ``income_total`` use the finance classification buckets above and are kept
    separate from transfers/unknowns to avoid calling every debit an expense.
    """
    from app.models.category import Category
    from app.models.commitment import CommitmentPayment, RecurringCommitment

    start, end = _month_range(year, month)
    txns = sorted(_transactions_in_range(session, start, end), key=lambda t: (t.date, t.time or "", t.id or 0))
    categories = {c.id: c for c in session.exec(select(Category)).all()}
    accounts = {a.id: a for a in session.exec(select(Account)).all()}

    txn_ids = [t.id for t in txns if t.id is not None]
    splits_by_txn: dict[int, list[TransactionSplit]] = defaultdict(list)
    if txn_ids:
        for split in session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id.in_(txn_ids))).all():
            splits_by_txn[split.transaction_id].append(split)

    commitment_payments = session.exec(
        select(CommitmentPayment).where(
            CommitmentPayment.paid_date >= start,
            CommitmentPayment.paid_date < end,
        )
    ).all()
    commitments = {c.id: c for c in session.exec(select(RecurringCommitment)).all()}
    commitment_by_txn: dict[int, list[dict]] = defaultdict(list)
    manual_commitments_by_date: dict[str, list[dict]] = defaultdict(list)
    for payment in commitment_payments:
        commitment = commitments.get(payment.commitment_id)
        if not commitment or payment.paid_date is None:
            continue
        item = {
            "payment_id": payment.id,
            "commitment_id": payment.commitment_id,
            "commitment_name": commitment.name,
            "period": payment.period,
            "amount": round(float(payment.allocated_amount), 2),
            "source_type": payment.source_type,
            "is_manual": payment.is_manual,
        }
        if payment.transaction_id is not None:
            commitment_by_txn[payment.transaction_id].append(item)
        else:
            manual_commitments_by_date[payment.paid_date.isoformat()].append(item)

    days: dict[str, dict] = {}
    month_totals = {
        "debit_total": 0.0,
        "credit_total": 0.0,
        "spend_total": 0.0,
        "income_total": 0.0,
        "transfer_total": 0.0,
        "unclassified_total": 0.0,
        "unclassified_count": 0,
        "transaction_count": len(txns),
    }

    def day_bucket(key: str) -> dict:
        if key not in days:
            days[key] = {
                "date": key,
                "day": int(key[-2:]),
                "debit_total": 0.0,
                "credit_total": 0.0,
                "spend_total": 0.0,
                "income_total": 0.0,
                "transfer_total": 0.0,
                "unclassified_total": 0.0,
                "unclassified_count": 0,
                "transactions": [],
                "manual_commitments": [],
            }
        return days[key]

    for txn in txns:
        key = txn.date.isoformat()
        day = day_bucket(key)
        amount = float(txn.amount)
        is_debit = txn.direction == Direction.DEBIT
        is_credit = txn.direction == Direction.CREDIT
        if is_debit:
            day["debit_total"] += amount
            month_totals["debit_total"] += amount
        elif is_credit:
            day["credit_total"] += amount
            month_totals["credit_total"] += amount

        if txn.transaction_type in MONEY_OUT_TYPES:
            day["spend_total"] += amount
            month_totals["spend_total"] += amount
        elif txn.transaction_type in MONEY_IN_TYPES:
            day["income_total"] += amount
            month_totals["income_total"] += amount
        elif txn.transaction_type in EXCLUDED_TYPES:
            day["transfer_total"] += amount
            month_totals["transfer_total"] += amount
        elif txn.transaction_type == TransactionType.UNKNOWN:
            day["unclassified_total"] += amount
            day["unclassified_count"] += 1
            month_totals["unclassified_total"] += amount
            month_totals["unclassified_count"] += 1

        category = categories.get(txn.category_id) if txn.category_id else None
        parent = categories.get(category.parent_id) if category and category.parent_id else None
        account = accounts.get(txn.account_id)
        split_rows = []
        for split in splits_by_txn.get(txn.id or -1, []):
            split_category = categories.get(split.category_id) if split.category_id else None
            split_parent = categories.get(split_category.parent_id) if split_category and split_category.parent_id else None
            split_rows.append({
                "id": split.id,
                "amount": round(float(split.amount), 2),
                "category_id": split.category_id,
                "category_name": split_category.name if split_category else None,
                "parent_category_name": split_parent.name if split_parent else None,
                "counterparty_id": split.counterparty_id,
                "notes": split.notes,
            })
        day["transactions"].append({
            "id": txn.id,
            "date": key,
            "time": txn.time,
            "amount": round(amount, 2),
            "direction": txn.direction.value if hasattr(txn.direction, "value") else str(txn.direction),
            "counterparty": txn.raw_counterparty,
            "narration": txn.raw_narration,
            "transaction_type": txn.transaction_type.value if hasattr(txn.transaction_type, "value") else str(txn.transaction_type),
            "category_id": txn.category_id,
            "category_name": category.name if category else None,
            "parent_category_name": parent.name if parent else None,
            "account_id": txn.account_id,
            "account_name": account.name if account else None,
            "needs_review": txn.needs_review,
            "splits": split_rows,
            "commitments": commitment_by_txn.get(txn.id or -1, []),
        })

    for key, rows in manual_commitments_by_date.items():
        day = day_bucket(key)
        day["manual_commitments"].extend(sorted(rows, key=lambda row: (row["commitment_name"], row["payment_id"])))

    ordered_days = [days[key] for key in sorted(days)]
    for day in ordered_days:
        for field in ("debit_total", "credit_total", "spend_total", "income_total", "transfer_total", "unclassified_total"):
            day[field] = round(float(day[field]), 2)
        day["net_movement"] = round(day["credit_total"] - day["debit_total"], 2)

    for field in ("debit_total", "credit_total", "spend_total", "income_total", "transfer_total", "unclassified_total"):
        month_totals[field] = round(float(month_totals[field]), 2)
    month_totals["net_movement"] = round(month_totals["credit_total"] - month_totals["debit_total"], 2)

    return {
        "month": f"{year:04d}-{month:02d}",
        "days": ordered_days,
        **month_totals,
    }


def calculate_account_balance(session: Session, account_id: int) -> float:
    account = session.get(Account, account_id)
    if not account:
        raise ValueError("account not found")
    txns = session.exec(select(Transaction).where(Transaction.account_id == account_id)).all()
    balance = account.opening_balance
    for t in txns:
        balance += t.amount if t.direction == Direction.CREDIT else -t.amount
    return round(balance, 2)


def _commitment_expected_for_period(commitment: RecurringCommitment, period: str) -> tuple[float, bool, str | None]:
    """Return (expected, is_due_period, schedule_note) for YYYY-MM."""
    year, month = (int(x) for x in period.split("-"))
    period_start = date_(year, month, 1)
    period_end = date_(year + 1, 1, 1) if month == 12 else date_(year, month + 1, 1)
    if commitment.start_date and period_end <= commitment.start_date:
        return 0.0, False, "before commitment start"
    if commitment.end_date and period_start > commitment.end_date:
        return 0.0, False, "after commitment end"

    freq = commitment.frequency.value
    if freq == "monthly":
        return float(commitment.expected_amount), True, None
    if freq in {"quarterly", "yearly"}:
        if not commitment.start_date:
            return float(commitment.expected_amount), True, "start_date required to determine recurrence exactly"
        cadence = 3 if freq == "quarterly" else 12
        months_from_start = (year - commitment.start_date.year) * 12 + (month - commitment.start_date.month)
        due = months_from_start >= 0 and months_from_start % cadence == 0
        return (float(commitment.expected_amount) if due else 0.0), due, None
    if freq == "weekly":
        if not commitment.start_date:
            return float(commitment.expected_amount), True, "start_date required to determine weekly recurrence exactly"
        weekday = commitment.start_date.weekday()
        _, days = calendar.monthrange(year, month)
        occurrences = sum(1 for day in range(1, days + 1) if date_(year, month, day).weekday() == weekday and date_(year, month, day) >= commitment.start_date and (not commitment.end_date or date_(year, month, day) <= commitment.end_date))
        return round(float(commitment.expected_amount) * occurrences, 2), occurrences > 0, None
    # CUSTOM has no interval field in the current schema, so do not fake a schedule.
    return float(commitment.expected_amount), True, "custom frequency requires manual review"


def calculate_commitment_status(session: Session, commitment_id: int, period: str) -> dict:
    """Read-only status for one commitment in one ``YYYY-MM`` period."""
    commitment = session.get(RecurringCommitment, commitment_id)
    if not commitment:
        raise ValueError("commitment not found")

    try:
        year, month = (int(x) for x in period.split("-"))
        if month < 1 or month > 12:
            raise ValueError
    except ValueError as exc:
        raise ValueError("period must be YYYY-MM") from exc

    effective_expected, is_due_period, schedule_note = _commitment_expected_for_period(commitment, period)
    payments = session.exec(
        select(CommitmentPayment).where(
            CommitmentPayment.commitment_id == commitment_id, CommitmentPayment.period == period
        )
    ).all()
    paid = sum(float(p.allocated_amount) for p in payments)

    if not is_due_period and paid <= 0:
        status = CommitmentStatus.SKIPPED
        virtual_auto_confirm = False
    else:
        # Auto-confirm is virtual/read-only; viewing a report never creates money rows.
        virtual_auto_confirm = False
        if paid <= 0 and commitment.auto_confirm and period <= date_.today().strftime("%Y-%m") and schedule_note is None:
            paid = effective_expected
            virtual_auto_confirm = True

        today = date_.today()
        current_period = today.strftime("%Y-%m")
        if schedule_note and paid <= 0:
            status = CommitmentStatus.NEEDS_REVIEW
        elif paid <= 0:
            if period < current_period or (period == current_period and commitment.due_day and today.day > commitment.due_day):
                status = CommitmentStatus.LATE
            else:
                status = CommitmentStatus.PENDING
        elif abs(paid - effective_expected) < 0.01:
            status = CommitmentStatus.COMPLETED
        elif paid < effective_expected:
            status = CommitmentStatus.PARTIAL if commitment.allow_partial_payment else CommitmentStatus.NEEDS_REVIEW
        else:
            status = CommitmentStatus.OVERPAID

    return {
        "commitment_id": commitment_id,
        "name": commitment.name,
        "group_name": commitment.group_name,
        "period": period,
        "expected_amount": round(effective_expected, 2),
        "base_expected_amount": round(float(commitment.expected_amount), 2),
        "paid_amount": round(paid, 2),
        "status": status,
        "schedule_note": schedule_note,
        "virtual_auto_confirm": virtual_auto_confirm,
        "payments": [
            {
                "id": p.id,
                "transaction_id": p.transaction_id,
                "allocated_amount": p.allocated_amount,
                "source_type": p.source_type,
                "is_manual": p.is_manual,
                "manual_note": p.manual_note,
                "paid_date": p.paid_date.isoformat() if p.paid_date else None,
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
    current_year = date_.today().year
    ytd_from_commitments = 0.0
    annual_scheduled_target = 0.0
    breakdown = []
    for c in commitments:
        payments = session.exec(select(CommitmentPayment).where(CommitmentPayment.commitment_id == c.id)).all()
        subtotal = sum(p.allocated_amount for p in payments)
        ytd_subtotal = sum(p.allocated_amount for p in payments if p.period.startswith(f"{current_year:04d}-"))
        total_from_commitments += subtotal
        ytd_from_commitments += ytd_subtotal
        if c.frequency.value == "monthly":
            annual_scheduled_target += c.expected_amount * 12
        breakdown.append({"commitment_id": c.id, "commitment_name": c.name, "total": round(subtotal, 2), "ytd": round(ytd_subtotal, 2)})

    adhoc = session.exec(select(GoalContribution).where(GoalContribution.goal_id == goal_id)).all()
    total_adhoc = sum(a.amount for a in adhoc)
    ytd_adhoc = sum(a.amount for a in adhoc if a.date.year == current_year)

    total = total_from_commitments + total_adhoc
    return {
        "goal_id": goal_id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "total_contributed": round(total, 2),
        "remaining": round(goal.target_amount - total, 2) if goal.target_amount else None,
        "by_commitment": breakdown,
        "adhoc_total": round(total_adhoc, 2),
        "current_year": current_year,
        "ytd_contributed": round(ytd_from_commitments + ytd_adhoc, 2),
        "annual_scheduled_target": round(annual_scheduled_target, 2),
    }
