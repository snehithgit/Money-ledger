from __future__ import annotations

from datetime import date as date_

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_session
from app.services.calculations import calculate_category_spend, calculate_cashflow, calculate_month_summary

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
