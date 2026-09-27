from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_session
from app.services.review_service import detect_recurring_amount_changes, list_review_inbox

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/inbox")
def review_inbox(session: Session = Depends(get_session), limit: int = 200):
    return list_review_inbox(session, limit)


@router.get("/amount-changes")
def amount_changes(session: Session = Depends(get_session)):
    return detect_recurring_amount_changes(session)
