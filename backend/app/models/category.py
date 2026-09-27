from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Category(SQLModel, table=True):
    """User-editable category tree (spec section 21 default tree).

    Self-referential parent_id gives one level of subcategory, which is
    all the spec asks for and all a household budget needs (YAGNI).
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")
    icon: Optional[str] = None
    color: Optional[str] = None
    is_system: bool = False  # seeded defaults; still user-editable/renamable
    sort_order: int = 0
