from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.label import Label, TransactionLabel
from app.schemas.schemas import LabelCreate

router = APIRouter(prefix="/api/labels", tags=["labels"])


@router.get("")
def list_labels(session: Session = Depends(get_session)):
    return session.exec(select(Label)).all()


@router.post("")
def create_label(payload: LabelCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Label).where(Label.name == payload.name)).first()
    if existing:
        raise HTTPException(400, "label already exists")
    label = Label(**payload.model_dump())
    session.add(label)
    session.commit()
    session.refresh(label)
    return label


@router.delete("/{label_id}")
def delete_label(label_id: int, session: Session = Depends(get_session)):
    label = session.get(Label, label_id)
    if not label:
        raise HTTPException(404, "label not found")
    for link in session.exec(select(TransactionLabel).where(TransactionLabel.label_id == label_id)).all():
        session.delete(link)
    session.delete(label)
    session.commit()
    return {"ok": True}
