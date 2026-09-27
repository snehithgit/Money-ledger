from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.category import Category
from app.schemas.schemas import CategoryCreate, CategoryUpdate

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("")
def list_categories(session: Session = Depends(get_session)):
    return session.exec(select(Category).order_by(Category.sort_order, Category.name)).all()


@router.post("")
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)):
    cat = Category(**payload.model_dump())
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/{category_id}")
def update_category(category_id: int, payload: CategoryUpdate, session: Session = Depends(get_session)):
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "category not found")
    if cat.is_system:
        raise HTTPException(400, "cannot delete a default system category - rename it instead")
    session.delete(cat)
    session.commit()
    return {"ok": True}
