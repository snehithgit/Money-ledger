from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from app.api.deps import get_session
from app.models.counterparty import Counterparty, CounterpartyAlias
from app.models.enums import Direction
from app.models.transaction import Transaction
from app.schemas.schemas import AddAliasRequest, CounterpartyCreate, CounterpartyUpdate, MergeCounterpartiesRequest
from app.services.counterparty_service import merge_counterparties

router = APIRouter(prefix="/api/counterparties", tags=["counterparties"])


@router.get("")
def list_counterparties(session: Session = Depends(get_session)):
    counterparties = session.exec(select(Counterparty)).all()
    out = []
    for cp in counterparties:
        txns = session.exec(select(Transaction).where(Transaction.counterparty_id == cp.id)).all()
        paid = sum(t.amount for t in txns if t.direction == Direction.DEBIT)
        received = sum(t.amount for t in txns if t.direction == Direction.CREDIT)
        aliases = session.exec(select(CounterpartyAlias).where(CounterpartyAlias.counterparty_id == cp.id)).all()
        out.append(
            {
                **cp.model_dump(),
                "aliases": [a.raw_text for a in aliases],
                "transaction_count": len(txns),
                "total_paid": round(paid, 2),
                "total_received": round(received, 2),
                "net_balance": round(received - paid, 2),
            }
        )
    return out


@router.post("")
def create_counterparty(payload: CounterpartyCreate, session: Session = Depends(get_session)):
    cp = Counterparty(**payload.model_dump())
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return cp


@router.patch("/{counterparty_id}")
def update_counterparty(counterparty_id: int, payload: CounterpartyUpdate, session: Session = Depends(get_session)):
    cp = session.get(Counterparty, counterparty_id)
    if not cp:
        raise HTTPException(404, "counterparty not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cp, k, v)
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return cp


@router.post("/{counterparty_id}/aliases")
def add_alias(counterparty_id: int, payload: AddAliasRequest, session: Session = Depends(get_session)):
    cp = session.get(Counterparty, counterparty_id)
    if not cp:
        raise HTTPException(404, "counterparty not found")
    existing = session.exec(select(CounterpartyAlias).where(CounterpartyAlias.raw_text == payload.raw_text)).first()
    if existing:
        raise HTTPException(400, f"'{payload.raw_text}' is already an alias of another counterparty - merge instead")
    session.add(CounterpartyAlias(raw_text=payload.raw_text, counterparty_id=counterparty_id))
    session.commit()
    return {"ok": True}


@router.post("/merge")
def merge(payload: MergeCounterpartiesRequest, session: Session = Depends(get_session)):
    try:
        result = merge_counterparties(session, payload.keep_id, payload.merge_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    session.commit()
    return result
