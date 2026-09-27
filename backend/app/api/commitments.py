from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.schemas.schemas import AttachPaymentRequest, CommitmentCreate, CommitmentUpdate, ManualContributionRequest
from app.services.calculations import calculate_commitment_status

router = APIRouter(prefix="/api/commitments", tags=["commitments"])


@router.get("")
def list_commitments(session: Session = Depends(get_session), period: str | None = None):
    period = period or date_.today().strftime("%Y-%m")
    commitments = session.exec(select(RecurringCommitment).where(RecurringCommitment.active == True)).all()  # noqa: E712
    return [calculate_commitment_status(session, c.id, period) for c in commitments]


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
    periods = session.exec(
        select(CommitmentPayment.period).where(CommitmentPayment.commitment_id == commitment_id).distinct()
    ).all()
    current = date_.today().strftime("%Y-%m")
    all_periods = sorted(set(periods) | {current})[-months:]
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
    payment = CommitmentPayment(
        commitment_id=commitment_id,
        transaction_id=payload.transaction_id,
        period=payload.period,
        allocated_amount=payload.allocated_amount,
        source_type=payload.source_type,
        is_manual=payload.transaction_id is None,
        manual_note=payload.manual_note,
    )
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


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
