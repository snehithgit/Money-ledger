from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.deps import get_session
from app.importers.dedup import manual_fingerprint
from app.models.account import Account
from app.models.enums import Direction, TransactionType
from app.models.label import Label, TransactionLabel
from app.models.transaction import Transaction, TransactionSplit
from app.rules.engine import apply_rules_to_transaction, clear_rule_derived, get_active_rules
from app.schemas.schemas import SplitTransactionRequest, TransactionCreate, TransactionUpdate, TransferCreate
from app.services.counterparty_service import resolve_counterparty

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _set_labels(session: Session, txn_id: int, label_ids: list[int]) -> None:
    existing = session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == txn_id)).all()
    for e in existing:
        session.delete(e)
    session.flush()
    for lid in label_ids:
        session.add(TransactionLabel(transaction_id=txn_id, label_id=lid))


def _serialize(session: Session, t: Transaction) -> dict:
    labels = session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == t.id)).all()
    label_names = []
    for tl in labels:
        lbl = session.get(Label, tl.label_id)
        if lbl:
            label_names.append(lbl.name)
    return {**t.model_dump(), "labels": label_names}


@router.get("")
def list_transactions(
    session: Session = Depends(get_session),
    account_id: int | None = None,
    category_id: int | None = None,
    counterparty_id: int | None = None,
    transaction_type: TransactionType | None = None,
    needs_review: bool | None = None,
    start: date_ | None = None,
    end: date_ | None = None,
    search: str | None = None,
    limit: int = Query(200, le=2000),
    offset: int = 0,
):
    stmt = select(Transaction)
    if account_id is not None:
        stmt = stmt.where(Transaction.account_id == account_id)
    if category_id is not None:
        stmt = stmt.where(Transaction.category_id == category_id)
    if counterparty_id is not None:
        stmt = stmt.where(Transaction.counterparty_id == counterparty_id)
    if transaction_type is not None:
        stmt = stmt.where(Transaction.transaction_type == transaction_type)
    if needs_review is not None:
        stmt = stmt.where(Transaction.needs_review == needs_review)
    if start is not None:
        stmt = stmt.where(Transaction.date >= start)
    if end is not None:
        stmt = stmt.where(Transaction.date <= end)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(
            (Transaction.raw_narration.ilike(like)) | (Transaction.raw_counterparty.ilike(like)) | (Transaction.notes.ilike(like))
        )
    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).offset(offset).limit(limit)
    txns = session.exec(stmt).all()
    return [_serialize(session, t) for t in txns]


@router.post("")
def create_transaction(payload: TransactionCreate, session: Session = Depends(get_session)):
    data = payload.model_dump(exclude={"label_ids"})
    reference = data.pop("reference") or f"manual-{manual_fingerprint()[:12]}"
    txn = Transaction(
        **data,
        reference=reference,
        source="manual",
        fingerprint=manual_fingerprint(),
        needs_review=False,
        classification_source="manual",
    )
    if txn.raw_counterparty:
        txn.counterparty_id = resolve_counterparty(session, txn.raw_counterparty).id
    session.add(txn)
    session.commit()
    session.refresh(txn)
    if payload.label_ids:
        _set_labels(session, txn.id, payload.label_ids)
        session.commit()
    return _serialize(session, txn)


@router.post("/transfer")
def create_transfer(payload: TransferCreate, session: Session = Depends(get_session)):
    if payload.source_account_id == payload.destination_account_id:
        raise HTTPException(400, "source and destination accounts must be different")
    if not session.get(Account, payload.source_account_id) or not session.get(Account, payload.destination_account_id):
        raise HTTPException(404, "account not found")
    ref = f"manual-transfer-{manual_fingerprint()[:12]}"
    common = dict(date=payload.date, amount=payload.amount, raw_narration=payload.notes or "Internal transfer", raw_counterparty="Own account transfer", source="manual", transaction_type=TransactionType.INTERNAL_TRANSFER, needs_review=False, classification_source="manual", notes=payload.notes)
    debit = Transaction(**common, direction=Direction.DEBIT, account_id=payload.source_account_id, reference=ref+"-out", fingerprint=manual_fingerprint())
    credit = Transaction(**common, direction=Direction.CREDIT, account_id=payload.destination_account_id, reference=ref+"-in", fingerprint=manual_fingerprint())
    session.add(debit); session.add(credit); session.flush()
    debit.linked_transaction_id = credit.id; credit.linked_transaction_id = debit.id
    session.add(debit); session.add(credit); session.commit(); session.refresh(debit); session.refresh(credit)
    return {"source": _serialize(session, debit), "destination": _serialize(session, credit)}



@router.get("/{transaction_id}")
def get_transaction(transaction_id: int, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    return _serialize(session, txn)


@router.patch("/{transaction_id}")
def update_transaction(transaction_id: int, payload: TransactionUpdate, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    data = payload.model_dump(exclude_unset=True, exclude={"label_ids"})
    if data and txn.matched_rule_id is not None:
        clear_rule_derived(session, txn)
    for k, v in data.items():
        setattr(txn, k, v)
    if data:
        txn.classification_source = "manual"
        txn.matched_rule_id = None
        txn.match_explanation = None
        txn.review_reason = None if txn.needs_review is False else txn.review_reason
    session.add(txn)
    session.commit()
    session.refresh(txn)
    if payload.label_ids is not None:
        _set_labels(session, txn.id, payload.label_ids)
        session.commit()
    return _serialize(session, txn)


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, session: Session = Depends(get_session)):
    from app.models.commitment import CommitmentPayment
    from app.models.goal import GoalContribution

    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    txns = [txn]
    if txn.linked_transaction_id:
        partner = session.get(Transaction, txn.linked_transaction_id)
        if partner:
            txns.append(partner)
    ids = [t.id for t in txns if t.id is not None]
    for t in txns:
        t.linked_transaction_id = None
        session.add(t)
    session.flush()
    for tid in ids:
        for row in session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == tid)).all(): session.delete(row)
        for row in session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id == tid)).all(): session.delete(row)
        for row in session.exec(select(CommitmentPayment).where(CommitmentPayment.transaction_id == tid)).all(): session.delete(row)
        for row in session.exec(select(GoalContribution).where(GoalContribution.transaction_id == tid)).all(): session.delete(row)
    for t in txns:
        session.delete(t)
    session.commit()
    return {"ok": True, "deleted_transaction_ids": ids}


@router.post("/transfer")
def create_transfer(payload: TransferCreate, session: Session = Depends(get_session)):
    if payload.source_account_id == payload.destination_account_id:
        raise HTTPException(400, "source and destination accounts must be different")
    if not session.get(Account, payload.source_account_id) or not session.get(Account, payload.destination_account_id):
        raise HTTPException(404, "account not found")
    ref = f"manual-transfer-{manual_fingerprint()[:12]}"
    common = dict(date=payload.date, amount=payload.amount, raw_narration=payload.notes or "Internal transfer", raw_counterparty="Own account transfer", source="manual", transaction_type=TransactionType.INTERNAL_TRANSFER, needs_review=False, classification_source="manual", notes=payload.notes)
    debit = Transaction(**common, direction=Direction.DEBIT, account_id=payload.source_account_id, reference=ref+"-out", fingerprint=manual_fingerprint())
    credit = Transaction(**common, direction=Direction.CREDIT, account_id=payload.destination_account_id, reference=ref+"-in", fingerprint=manual_fingerprint())
    session.add(debit); session.add(credit); session.flush()
    debit.linked_transaction_id = credit.id; credit.linked_transaction_id = debit.id
    session.add(debit); session.add(credit); session.commit(); session.refresh(debit); session.refresh(credit)
    return {"source": _serialize(session, debit), "destination": _serialize(session, credit)}



@router.get("/{transaction_id}")
def get_transaction(transaction_id: int, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    return _serialize(session, txn)


@router.patch("/{transaction_id}")
def update_transaction(transaction_id: int, payload: TransactionUpdate, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    data = payload.model_dump(exclude_unset=True, exclude={"label_ids"})
    if data and txn.matched_rule_id is not None:
        clear_rule_derived(session, txn)
    for k, v in data.items():
        setattr(txn, k, v)
    if data:
        txn.classification_source = "manual"
        txn.matched_rule_id = None
        txn.match_explanation = None
        txn.review_reason = None if txn.needs_review is False else txn.review_reason
    session.add(txn)
    session.commit()
    session.refresh(txn)
    if payload.label_ids is not None:
        _set_labels(session, txn.id, payload.label_ids)
        session.commit()
    return _serialize(session, txn)


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    from app.models.commitment import CommitmentPayment
    from app.models.goal import GoalContribution
    for row in session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == transaction_id)).all(): session.delete(row)
    for row in session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id == transaction_id)).all(): session.delete(row)
    for row in session.exec(select(CommitmentPayment).where(CommitmentPayment.transaction_id == transaction_id)).all(): session.delete(row)
    for row in session.exec(select(GoalContribution).where(GoalContribution.transaction_id == transaction_id)).all(): session.delete(row)
    session.delete(txn)
    session.commit()
    return {"ok": True}


@router.post("/{transaction_id}/reapply-rules")
def reapply_rules(transaction_id: int, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    apply_rules_to_transaction(session, txn, get_active_rules(session), force_manual=True)
    session.add(txn)
    session.commit()
    session.refresh(txn)
    return _serialize(session, txn)


@router.post("/{transaction_id}/split")
def split_transaction(transaction_id: int, payload: SplitTransactionRequest, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    total = sum(s.amount for s in payload.splits)
    if abs(total - txn.amount) > 0.01:
        raise HTTPException(400, f"splits must sum to the transaction amount ({txn.amount}), got {total}")

    existing = session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id == transaction_id)).all()
    for e in existing:
        session.delete(e)
    session.flush()

    for s in payload.splits:
        session.add(TransactionSplit(transaction_id=transaction_id, **s.model_dump()))
    session.commit()
    return {"ok": True}


@router.get("/{transaction_id}/splits")
def get_splits(transaction_id: int, session: Session = Depends(get_session)):
    return session.exec(select(TransactionSplit).where(TransactionSplit.transaction_id == transaction_id)).all()
