from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_session
from app.services.calculations import calculate_category_spend, calculate_cashflow, calculate_money_calendar, calculate_month_summary

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/cashflow")
def cashflow(start: date_, end: date_, account_id: int | None = None, session: Session = Depends(get_session)):
    return calculate_cashflow(session, start, end, account_id)


@router.get("/month-summary")
def month_summary(year: int, month: int, session: Session = Depends(get_session)):
    return calculate_month_summary(session, year, month)


@router.get("/category-spend")
def category_spend(start: date_, end: date_, session: Session = Depends(get_session)):
    return calculate_category_spend(session, start, end)


@router.get("/trend")
def trend(months: int = 6, session: Session = Depends(get_session)):
    months = max(1, min(months, 60))
    today = date_.today()
    rows = []
    for offset in range(months - 1, -1, -1):
        total = today.year * 12 + (today.month - 1) - offset
        year, month0 = divmod(total, 12)
        rows.append(calculate_month_summary(session, year, month0 + 1))
    return rows


@router.get("/calendar")
def money_calendar(year: int, month: int, session: Session = Depends(get_session)):
    if month < 1 or month > 12:
        from fastapi import HTTPException
        raise HTTPException(400, "month must be between 1 and 12")
    return calculate_money_calendar(session, year, month)
