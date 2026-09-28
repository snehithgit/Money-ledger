from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.schemas.schemas import (
    AttachPaymentRequest,
    BulkCommitmentPaymentRequest,
    CommitmentCreate,
    CommitmentUpdate,
    ManualContributionRequest,
)
from app.services.calculations import calculate_commitment_status

router = APIRouter(prefix="/api/commitments", tags=["commitments"])


def _parse_period(period: str) -> tuple[int, int]:
    try:
        year, month = (int(x) for x in period.split("-"))
        if month < 1 or month > 12:
            raise ValueError
        return year, month
    except ValueError:
        raise HTTPException(400, "period must be YYYY-MM")


def _month_bounds(period: str) -> tuple[date_, date_]:
    year, month = _parse_period(period)
    start = date_(year, month, 1)
    end = date_(year + 1, 1, 1) if month == 12 else date_(year, month + 1, 1)
    return start, end


def _resolve_paid_date(session: Session, transaction_id: int | None, explicit_paid_date: date_ | None) -> date_:
    if explicit_paid_date:
        return explicit_paid_date
    if transaction_id is not None:
        from app.models.transaction import Transaction
        txn = session.get(Transaction, transaction_id)
        if not txn:
            raise HTTPException(404, "transaction not found")
        return txn.date
    return date_.today()


def _validate_transaction_allocation(session: Session, commitment: RecurringCommitment, transaction_id: int, period: str, amount: float, exclude_payment_id: int | None = None) -> None:
    from app.models.transaction import Transaction

    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    all_rows = session.exec(select(CommitmentPayment).where(CommitmentPayment.transaction_id == transaction_id)).all()
    allocated_elsewhere = sum(float(r.allocated_amount) for r in all_rows if r.id != exclude_payment_id)
    if allocated_elsewhere + amount > float(txn.amount) + 0.005:
        raise HTTPException(400, f"total commitment allocation cannot exceed transaction amount ({txn.amount})")
    if not commitment.allow_multiple_transactions:
        same_period = session.exec(select(CommitmentPayment).where(CommitmentPayment.commitment_id == commitment.id, CommitmentPayment.period == period)).all()
        other_txns = {r.transaction_id for r in same_period if r.transaction_id is not None and r.transaction_id != transaction_id and r.id != exclude_payment_id}
        if other_txns:
            raise HTTPException(400, f"'{commitment.name}' allows only one transaction per period")


@router.get("")
def list_commitments(session: Session = Depends(get_session), period: str | None = None):
    period = period or date_.today().strftime("%Y-%m")
    commitments = session.exec(select(RecurringCommitment).where(RecurringCommitment.active == True)).all()  # noqa: E712
    return [calculate_commitment_status(session, c.id, period) for c in commitments]


@router.get("/calendar")
def commitment_calendar(session: Session = Depends(get_session), month: str | None = None):
    month = month or date_.today().strftime("%Y-%m")
    start, end = _month_bounds(month)
    payments = session.exec(
        select(CommitmentPayment).where(
            CommitmentPayment.paid_date >= start,
            CommitmentPayment.paid_date < end,
        )
    ).all()

    by_day: dict[str, dict] = {}
    for payment in payments:
        if payment.paid_date is None:
            continue
        commitment = session.get(RecurringCommitment, payment.commitment_id)
        if not commitment or not commitment.active:
            continue
        key = payment.paid_date.isoformat()
        day = by_day.setdefault(
            key,
            {
                "date": key,
                "day": payment.paid_date.day,
                "total_paid": 0.0,
                "items": [],
            },
        )
        day["total_paid"] = round(float(day["total_paid"]) + float(payment.allocated_amount), 2)
        day["items"].append(
            {
                "payment_id": payment.id,
                "commitment_id": payment.commitment_id,
                "commitment_name": commitment.name,
                "group_name": commitment.group_name,
                "period": payment.period,
                "amount": round(float(payment.allocated_amount), 2),
                "source_type": payment.source_type,
                "is_manual": payment.is_manual,
                "manual_note": payment.manual_note,
                "transaction_id": payment.transaction_id,
            }
        )

    days = sorted(by_day.values(), key=lambda row: row["date"])
    for day in days:
        day["items"].sort(key=lambda row: (row["commitment_name"].lower(), row["period"], row["payment_id"]))

    return {
        "month": month,
        "days": days,
        "payments_count": sum(len(day["items"]) for day in days),
        "days_with_payments": len(days),
        "total_paid": round(sum(float(day["total_paid"]) for day in days), 2),
    }


@router.post("")
def create_commitment(payload: CommitmentCreate, session: Session = Depends(get_session)):
    c = RecurringCommitment(**payload.model_dump())
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.get("/{commitment_id}")
def get_commitment(commitment_id: int, session: Session = Depends(get_session), period: str | None = None):
    period = period or date_.today().strftime("%Y-%m")
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")
    return calculate_commitment_status(session, commitment_id, period)


@router.get("/{commitment_id}/history")
def commitment_history(commitment_id: int, session: Session = Depends(get_session), months: int = 12):
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")
    months = max(1, min(months, 120))
    today = date_.today()
    current_total = today.year * 12 + today.month - 1
    all_periods = []
    for offset in range(months - 1, -1, -1):
        y, m0 = divmod(current_total - offset, 12)
        period = f"{y:04d}-{m0 + 1:02d}"
        if c.start_date and period < c.start_date.strftime("%Y-%m"):
            continue
        if c.end_date and period > c.end_date.strftime("%Y-%m"):
            continue
        all_periods.append(period)
    return [calculate_commitment_status(session, commitment_id, p) for p in all_periods]


@router.patch("/{commitment_id}")
def update_commitment(commitment_id: int, payload: CommitmentUpdate, session: Session = Depends(get_session)):
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.post("/{commitment_id}/payments")
def attach_payment(commitment_id: int, payload: AttachPaymentRequest, session: Session = Depends(get_session)):
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")

    existing = None
    if payload.transaction_id is None and not c.manual_contributions_allowed:
        raise HTTPException(400, f"'{c.name}' does not allow manual contributions")
    if payload.transaction_id is not None:
        existing = session.exec(
            select(CommitmentPayment).where(
                CommitmentPayment.commitment_id == commitment_id,
                CommitmentPayment.transaction_id == payload.transaction_id,
            )
        ).first()

    if payload.transaction_id is not None:
        _validate_transaction_allocation(session, c, payload.transaction_id, payload.period, payload.allocated_amount, existing.id if existing else None)

    paid_date = _resolve_paid_date(session, payload.transaction_id, payload.paid_date)

    if existing:
        existing.period = payload.period
        existing.allocated_amount = payload.allocated_amount
        existing.source_type = payload.source_type
        existing.manual_note = payload.manual_note
        existing.paid_date = paid_date
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    payment = CommitmentPayment(
        commitment_id=commitment_id,
        transaction_id=payload.transaction_id,
        period=payload.period,
        allocated_amount=payload.allocated_amount,
        source_type=payload.source_type,
        is_manual=payload.transaction_id is None,
        manual_note=payload.manual_note,
        paid_date=paid_date,
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.post("/{commitment_id}/bulk-payment")
def bulk_payment(commitment_id: int, payload: BulkCommitmentPaymentRequest, session: Session = Depends(get_session)):
    """One lump-sum payment covering several consecutive periods (e.g.
    a whole year's Sukanya contribution paid in a single transfer).
    Spreads the total evenly across the given number of months so each
    one shows as fulfilled instead of pending."""
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")
    if payload.periods < 1:
        raise HTTPException(400, "periods must be at least 1")

    try:
        year, month = (int(x) for x in payload.start_period.split("-"))
        if month < 1 or month > 12:
            raise ValueError
    except ValueError:
        raise HTTPException(400, "start_period must be YYYY-MM")
    if payload.transaction_id is None and not c.manual_contributions_allowed:
        raise HTTPException(400, f"'{c.name}' does not allow manual contributions")
    if payload.transaction_id is not None:
        stale = session.exec(
            select(CommitmentPayment).where(
                CommitmentPayment.commitment_id == commitment_id,
                CommitmentPayment.transaction_id == payload.transaction_id,
            )
        ).all()
        for row in stale:
            session.delete(row)
        session.flush()
        _validate_transaction_allocation(session, c, payload.transaction_id, payload.start_period, payload.total_amount)

    paid_date = _resolve_paid_date(session, payload.transaction_id, payload.paid_date)
    per_period = round(payload.total_amount / payload.periods, 2)
    remaining = round(payload.total_amount, 2)
    created: list[CommitmentPayment] = []
    for i in range(payload.periods):
        total_month0 = (month - 1) + i
        period = f"{year + total_month0 // 12:04d}-{total_month0 % 12 + 1:02d}"
        amount = per_period if i < payload.periods - 1 else remaining
        remaining = round(remaining - amount, 2)

        payment = CommitmentPayment(
            commitment_id=commitment_id,
            transaction_id=payload.transaction_id,
            period=period,
            allocated_amount=amount,
            source_type=payload.source_type,
            is_manual=payload.transaction_id is None,
            manual_note=payload.manual_note or f"Part of a lump-sum payment covering {payload.periods} months",
            paid_date=paid_date,
        )
        session.add(payment)
        created.append(payment)

    session.commit()
    for p in created:
        session.refresh(p)
    return created


@router.post("/{commitment_id}/manual-contribution")
def manual_contribution(commitment_id: int, payload: ManualContributionRequest, session: Session = Depends(get_session)):
    """For obligations satisfied outside PhonePe entirely - e.g. the
    wife's ₹1,000/month Sukanya contribution auto-deducted from her own
    account, which never appears in the user's PhonePe statement."""
    c = session.get(RecurringCommitment, commitment_id)
    if not c:
        raise HTTPException(404, "commitment not found")
    if not c.manual_contributions_allowed:
        raise HTTPException(400, f"'{c.name}' does not allow manual contributions")
    payment = CommitmentPayment(
        commitment_id=commitment_id,
        transaction_id=None,
        period=payload.period,
        allocated_amount=payload.allocated_amount,
        source_type="manual",
        is_manual=True,
        manual_note=payload.manual_note,
        paid_date=_resolve_paid_date(session, None, payload.paid_date),
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: int, session: Session = Depends(get_session)):
    p = session.get(CommitmentPayment, payment_id)
    if not p:
        raise HTTPException(404, "payment not found")
    session.delete(p)
    session.commit()
    return {"ok": True}
