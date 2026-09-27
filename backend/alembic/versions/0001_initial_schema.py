"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-27

This mirrors exactly what `init_db()` creates via
`SQLModel.metadata.create_all()` on first run - the app does not
require Alembic to function (a fresh SQLite file self-initializes),
but this migration exists so future schema changes have a real
baseline to diff against, per the project's "DB migrations/schema"
deliverable.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, index=True),
        sa.Column("account_type", sa.String, nullable=False),
        sa.Column("institution", sa.String),
        sa.Column("masked_number", sa.String),
        sa.Column("owner", sa.String),
        sa.Column("opening_balance", sa.Float, nullable=False, server_default="0"),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "category",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, index=True),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("icon", sa.String),
        sa.Column("color", sa.String),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "label",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True, index=True),
        sa.Column("color", sa.String),
    )

    op.create_table(
        "counterparty",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("display_name", sa.String, nullable=False, index=True),
        sa.Column("relationship", sa.String, nullable=False),
        sa.Column("default_category_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("notes", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "counterpartyalias",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("raw_text", sa.String, nullable=False, unique=True, index=True),
        sa.Column("counterparty_id", sa.Integer, sa.ForeignKey("counterparty.id"), nullable=False, index=True),
    )

    op.create_table(
        "rule",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String),
        sa.Column("conditions", sa.JSON, nullable=False),
        sa.Column("actions", sa.JSON, nullable=False),
        sa.Column("priority", sa.Integer, nullable=False, server_default="100"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("matched_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "goal",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("target_amount", sa.Float),
        sa.Column("target_date", sa.Date),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("notes", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "goalcontribution",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("goal_id", sa.Integer, sa.ForeignKey("goal.id"), nullable=False, index=True),
        sa.Column("transaction_id", sa.Integer, sa.ForeignKey("transaction.id")),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("is_manual", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("manual_note", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "recurringcommitment",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("group_name", sa.String),
        sa.Column("expected_amount", sa.Float, nullable=False),
        sa.Column("frequency", sa.String, nullable=False),
        sa.Column("due_day", sa.Integer),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("payment_account_id", sa.Integer, sa.ForeignKey("account.id")),
        sa.Column("beneficiary_counterparty_id", sa.Integer, sa.ForeignKey("counterparty.id")),
        sa.Column("matching_rule_id", sa.Integer, sa.ForeignKey("rule.id")),
        sa.Column("goal_id", sa.Integer, sa.ForeignKey("goal.id")),
        sa.Column("allow_partial_payment", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("allow_multiple_transactions", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("manual_contributions_allowed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "importbatch",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("archived_path", sa.String),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("account.id")),
        sa.Column("imported_at", sa.DateTime, nullable=False),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("transactions_found", sa.Integer, nullable=False, server_default="0"),
        sa.Column("transactions_new", sa.Integer, nullable=False, server_default="0"),
        sa.Column("transactions_duplicate", sa.Integer, nullable=False, server_default="0"),
        sa.Column("transactions_failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("transactions_needs_review", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_message", sa.String),
    )

    op.create_table(
        "transaction",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("date", sa.Date, nullable=False, index=True),
        sa.Column("time", sa.String),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("direction", sa.String, nullable=False),
        sa.Column("raw_narration", sa.String, nullable=False),
        sa.Column("raw_counterparty", sa.String, nullable=False),
        sa.Column("upi_id", sa.String),
        sa.Column("reference", sa.String, nullable=False, index=True),
        sa.Column("utr", sa.String),
        sa.Column("raw_instrument", sa.String),
        sa.Column("source", sa.String, nullable=False, server_default="manual"),
        sa.Column("source_file", sa.String),
        sa.Column("import_batch_id", sa.Integer, sa.ForeignKey("importbatch.id"), index=True),
        sa.Column("fingerprint", sa.String, nullable=False, unique=True, index=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("account.id"), nullable=False, index=True),
        sa.Column("transaction_type", sa.String, nullable=False),
        sa.Column("counterparty_id", sa.Integer, sa.ForeignKey("counterparty.id"), index=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("subcategory_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("notes", sa.String),
        sa.Column("linked_transaction_id", sa.Integer, sa.ForeignKey("transaction.id")),
        sa.Column("needs_review", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("review_reason", sa.String),
        sa.Column("matched_rule_id", sa.Integer, sa.ForeignKey("rule.id")),
        sa.Column("match_explanation", sa.String),
        sa.Column("is_ignored", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "transactionsplit",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("transaction_id", sa.Integer, sa.ForeignKey("transaction.id"), nullable=False, index=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("category.id")),
        sa.Column("counterparty_id", sa.Integer, sa.ForeignKey("counterparty.id")),
        sa.Column("notes", sa.String),
    )

    op.create_table(
        "transactionlabel",
        sa.Column("transaction_id", sa.Integer, sa.ForeignKey("transaction.id"), primary_key=True),
        sa.Column("label_id", sa.Integer, sa.ForeignKey("label.id"), primary_key=True),
    )

    op.create_table(
        "commitmentpayment",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("commitment_id", sa.Integer, sa.ForeignKey("recurringcommitment.id"), nullable=False, index=True),
        sa.Column("transaction_id", sa.Integer, sa.ForeignKey("transaction.id"), index=True),
        sa.Column("period", sa.String, nullable=False, index=True),
        sa.Column("allocated_amount", sa.Float, nullable=False),
        sa.Column("source_type", sa.String, nullable=False, server_default="phonepe"),
        sa.Column("is_manual", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("manual_note", sa.String),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "budget",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("category.id"), nullable=False),
        sa.Column("monthly_limit", sa.Float, nullable=False),
        sa.Column("period", sa.String),
        sa.Column("notes", sa.String),
    )

    op.create_table(
        "setting",
        sa.Column("key", sa.String, primary_key=True),
        sa.Column("value", sa.String),
    )


def downgrade() -> None:
    for table in (
        "setting",
        "budget",
        "commitmentpayment",
        "transactionlabel",
        "transactionsplit",
        "transaction",
        "importbatch",
        "recurringcommitment",
        "goalcontribution",
        "goal",
        "rule",
        "counterpartyalias",
        "counterparty",
        "label",
        "category",
        "account",
    ):
        op.drop_table(table)
