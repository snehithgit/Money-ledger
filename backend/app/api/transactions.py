from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.api.deps import get_session
from app.importers.dedup import manual_fingerprint
from app.models.enums import Direction, TransactionType
from app.models.label import Label, TransactionLabel
from app.models.transaction import Transaction, TransactionSplit
from app.rules.engine import apply_rules_to_transaction, get_active_rules
from app.schemas.schemas import SplitTransactionRequest, TransactionCreate, TransactionUpdate
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
    for k, v in data.items():
        setattr(txn, k, v)
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
    session.delete(txn)
    session.commit()
    return {"ok": True}


@router.post("/{transaction_id}/reapply-rules")
def reapply_rules(transaction_id: int, session: Session = Depends(get_session)):
    txn = session.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    apply_rules_to_transaction(session, txn, get_active_rules(session))
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
