from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.account import Account
from app.schemas.schemas import AccountCreate, AccountUpdate
from app.services.calculations import calculate_account_balance

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(session: Session = Depends(get_session)):
    accounts = session.exec(select(Account).where(Account.is_archived == False)).all()  # noqa: E712
    return [
        {**a.model_dump(), "balance": calculate_account_balance(session, a.id)}
        for a in accounts
    ]


@router.post("")
def create_account(payload: AccountCreate, session: Session = Depends(get_session)):
    account = Account(**payload.model_dump())
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.get("/{account_id}")
def get_account(account_id: int, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(404, "account not found")
    return {**account.model_dump(), "balance": calculate_account_balance(session, account_id)}


@router.patch("/{account_id}")
def update_account(account_id: int, payload: AccountUpdate, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(404, "account not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(account, k, v)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.delete("/{account_id}")
def archive_account(account_id: int, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(404, "account not found")
    account.is_archived = True
    session.add(account)
    session.commit()
    return {"ok": True}
