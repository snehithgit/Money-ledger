"""
Review Inbox (spec section 15): surfaces everything the rule engine
couldn't resolve on its own, with enough context to Accept / Edit /
Categorize / Create rule / Merge counterparty / Mark transfer / Ignore.

Every reason here is computed, never guessed - no confidence scores,
just "this is why it's here."
"""
from __future__ import annotations

from collections import defaultdict

from sqlmodel import Session, select

from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.models.transaction import Transaction


def list_review_inbox(session: Session, limit: int = 200) -> dict:
    txns = session.exec(
        select(Transaction)
        .where(Transaction.needs_review == True, Transaction.is_ignored == False)  # noqa: E712
        .order_by(Transaction.date.desc())
        .limit(limit)
    ).all()

    by_reason: dict[str, list[Transaction]] = defaultdict(list)
    for t in txns:
        by_reason[t.review_reason or "unclassified"].append(t)

    def _ser(t: Transaction) -> dict:
        return {
            "id": t.id,
            "date": t.date.isoformat(),
            "amount": t.amount,
            "direction": t.direction,
            "raw_narration": t.raw_narration,
            "raw_counterparty": t.raw_counterparty,
            "account_id": t.account_id,
            "review_reason": t.review_reason,
            "match_explanation": t.match_explanation,
        }

    groups = []
    for reason, items in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
        groups.append({"reason": reason, "count": len(items), "transactions": [_ser(t) for t in items]})

    return {"total": len(txns), "groups": groups}


def detect_recurring_amount_changes(session: Session) -> list[dict]:
    """Flag commitments whose most recent payment amount differs from
    the commitment's expected_amount - the "amount changed from
    recurring payment" case from spec section 15, e.g. a monthly
    transfer that used to be 11,500 and is now 21,000. This never
    auto-updates the commitment; it just surfaces the discrepancy.
    """
    alerts = []
    commitments = session.exec(select(RecurringCommitment).where(RecurringCommitment.active == True)).all()  # noqa: E712
    for c in commitments:
        payments = session.exec(
            select(CommitmentPayment).where(CommitmentPayment.commitment_id == c.id).order_by(CommitmentPayment.period.desc())
        ).all()
        if not payments:
            continue
        latest_period = payments[0].period
        latest_total = sum(p.allocated_amount for p in payments if p.period == latest_period)
        if abs(latest_total - c.expected_amount) > 0.01:
            alerts.append(
                {
                    "commitment_id": c.id,
                    "commitment_name": c.name,
                    "period": latest_period,
                    "expected_amount": c.expected_amount,
                    "actual_amount": round(latest_total, 2),
                }
            )
    return alerts
