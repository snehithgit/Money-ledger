from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Budget(SQLModel, table=True):
    """A monthly spending budget per category. Phase 6 scope in the
    spec; the table is included now (schema section 38) so nothing
    later needs a migration, but no UI/logic is built against it yet.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="category.id")
    monthly_limit: float
    period: Optional[str] = None  # "YYYY-MM", null = ongoing default
    notes: Optional[str] = None
