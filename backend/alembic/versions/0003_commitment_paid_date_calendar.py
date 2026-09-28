"""commitment payment paid_date for calendar view

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-28
"""
from __future__ import annotations

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("commitmentpayment") as batch:
        batch.add_column(sa.Column("paid_date", sa.Date(), nullable=True))
        batch.create_index("ix_commitmentpayment_paid_date", ["paid_date"])

    op.execute(sa.text("""
        UPDATE commitmentpayment
        SET paid_date = (
            SELECT date FROM "transaction" t
            WHERE t.id = commitmentpayment.transaction_id
        )
        WHERE paid_date IS NULL AND transaction_id IS NOT NULL
    """))
    op.execute(sa.text("UPDATE commitmentpayment SET paid_date = DATE(created_at) WHERE paid_date IS NULL"))


def downgrade() -> None:
    with op.batch_alter_table("commitmentpayment") as batch:
        batch.drop_index("ix_commitmentpayment_paid_date")
        batch.drop_column("paid_date")
