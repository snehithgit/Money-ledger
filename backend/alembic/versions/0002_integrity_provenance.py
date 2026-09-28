"""data-integrity provenance and auto-confirm compatibility

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-28
"""
from __future__ import annotations

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("transaction") as batch:
        batch.add_column(sa.Column("classification_source", sa.String(), nullable=False, server_default="unclassified"))
    op.execute(sa.text("""UPDATE "transaction" SET classification_source = CASE WHEN matched_rule_id IS NOT NULL THEN 'rule' WHEN needs_review = 0 THEN 'manual' ELSE 'unclassified' END"""))

    with op.batch_alter_table("transactionlabel") as batch:
        batch.add_column(sa.Column("rule_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_transactionlabel_rule_id", "rule", ["rule_id"], ["id"])
        batch.create_index("ix_transactionlabel_rule_id", ["rule_id"])

    with op.batch_alter_table("commitmentpayment") as batch:
        batch.add_column(sa.Column("rule_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_commitmentpayment_rule_id", "rule", ["rule_id"], ["id"])
        batch.create_index("ix_commitmentpayment_rule_id", ["rule_id"])

    with op.batch_alter_table("goalcontribution") as batch:
        batch.add_column(sa.Column("rule_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_goalcontribution_rule_id", "rule", ["rule_id"], ["id"])
        batch.create_index("ix_goalcontribution_rule_id", ["rule_id"])

    # 0001 predated the model's auto_confirm flag.
    with op.batch_alter_table("recurringcommitment") as batch:
        batch.add_column(sa.Column("auto_confirm", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("recurringcommitment") as batch:
        batch.drop_column("auto_confirm")
    with op.batch_alter_table("goalcontribution") as batch:
        batch.drop_index("ix_goalcontribution_rule_id")
        batch.drop_constraint("fk_goalcontribution_rule_id", type_="foreignkey")
        batch.drop_column("rule_id")
    with op.batch_alter_table("commitmentpayment") as batch:
        batch.drop_index("ix_commitmentpayment_rule_id")
        batch.drop_constraint("fk_commitmentpayment_rule_id", type_="foreignkey")
        batch.drop_column("rule_id")
    with op.batch_alter_table("transactionlabel") as batch:
        batch.drop_index("ix_transactionlabel_rule_id")
        batch.drop_constraint("fk_transactionlabel_rule_id", type_="foreignkey")
        batch.drop_column("rule_id")
    with op.batch_alter_table("transaction") as batch:
        batch.drop_column("classification_source")
