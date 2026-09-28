"""
The rule engine: deterministic, explainable, no ML.

For each transaction, every *active* rule is checked in priority order
(all conditions in a rule must match - AND semantics). What happens
next depends on how many rules match:

  * 0 rules match  -> transaction stays UNKNOWN / needs_review=True.
  * 1 rule matches  -> its actions are applied automatically, and
    `match_explanation` records exactly which conditions fired, so
    every auto-categorized transaction can show its "why" (spec
    section 45: no unexplained auto-categorization).
  * 2+ rules match  -> nothing is applied automatically. The
    transaction is flagged needs_review with reason "rule_conflict"
    and the explanation lists every rule that matched, so the user
    resolves the ambiguity in the Review Inbox instead of the engine
    guessing (spec section 15/45).

Rules never guess a confidence score - a rule either matches or it
doesn't.
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models.rule import Rule
from app.models.transaction import Transaction
from app.models.label import TransactionLabel
from app.models.enums import TransactionType
from app.models.commitment import CommitmentPayment
from app.models.goal import GoalContribution
from app.rules.conditions import matches_all, explain_match


def get_active_rules(session: Session) -> list[Rule]:
    return session.exec(select(Rule).where(Rule.is_active == True).order_by(Rule.priority)).all()  # noqa: E712


def clear_rule_derived(session: Session, txn: Transaction) -> None:
    """Remove only data created by rules; never touch manual user data."""
    if txn.id is None:
        return
    for row in session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == txn.id, TransactionLabel.rule_id.is_not(None))).all():
        session.delete(row)
    for row in session.exec(select(CommitmentPayment).where(CommitmentPayment.transaction_id == txn.id, CommitmentPayment.rule_id.is_not(None))).all():
        session.delete(row)
    for row in session.exec(select(GoalContribution).where(GoalContribution.transaction_id == txn.id, GoalContribution.rule_id.is_not(None))).all():
        session.delete(row)

    # Backward compatibility for rows created before provenance columns
    # existed: use the transaction's previous matched rule to identify only
    # the exact legacy links that rule could have created.
    if txn.matched_rule_id:
        old_rule = session.get(Rule, txn.matched_rule_id)
        if old_rule:
            for action in old_rule.actions:
                value = action.get("value")
                if action.get("type") == "set_label" and value is not None:
                    row = session.exec(select(TransactionLabel).where(TransactionLabel.transaction_id == txn.id, TransactionLabel.label_id == int(value), TransactionLabel.rule_id.is_(None))).first()
                    if row: session.delete(row)
                elif action.get("type") == "attach_commitment" and value is not None:
                    for row in session.exec(select(CommitmentPayment).where(CommitmentPayment.transaction_id == txn.id, CommitmentPayment.commitment_id == int(value), CommitmentPayment.rule_id.is_(None))).all(): session.delete(row)
                elif action.get("type") == "attach_goal" and value is not None:
                    for row in session.exec(select(GoalContribution).where(GoalContribution.transaction_id == txn.id, GoalContribution.goal_id == int(value), GoalContribution.rule_id.is_(None))).all(): session.delete(row)
    session.flush()


def apply_rules_to_transaction(session: Session, txn: Transaction, rules: list[Rule] | None = None, *, force_manual: bool = False) -> Transaction:
    # A human-reviewed classification is authoritative. Bulk re-application
    # must not erase it. An explicit per-transaction reapply can opt in.
    if txn.classification_source == "manual" and not force_manual:
        return txn
    clear_rule_derived(session, txn)
    if rules is None:
        rules = get_active_rules(session)

    matched: list[Rule] = [r for r in rules if matches_all(txn, r.conditions)]

    if len(matched) == 0:
        # No active rule justifies a classification any more (this
        # matters on re-evaluation, e.g. after a rule was deleted or
        # narrowed) - fall back to UNKNOWN rather than keeping a stale
        # classification with nothing backing it.
        txn.needs_review = True
        txn.review_reason = txn.review_reason or "no_rule_matched"
        txn.matched_rule_id = None
        txn.match_explanation = None
        txn.transaction_type = TransactionType.UNKNOWN
        txn.classification_source = "unclassified"
        return txn

    if len(matched) > 1:
        names = ", ".join(f"'{r.name}'" for r in matched)
        txn.needs_review = True
        txn.review_reason = "rule_conflict"
        txn.match_explanation = f"Rule conflict: {names} all matched. Resolve manually or narrow the rules."
        txn.matched_rule_id = None
        txn.transaction_type = TransactionType.UNKNOWN
        txn.classification_source = "unclassified"
        return txn

    rule = matched[0]
    rule.matched_count = (rule.matched_count or 0) + 1
    session.add(rule)

    _apply_actions(session, txn, rule)
    txn.classification_source = "rule"
    txn.matched_rule_id = rule.id
    txn.match_explanation = f"Matched rule '{rule.name}': {explain_match(rule.conditions)}"
    return txn


def _period_for(txn: Transaction) -> str:
    return f"{txn.date.year:04d}-{txn.date.month:02d}"


def _apply_actions(session: Session, txn: Transaction, rule: Rule) -> None:
    txn.needs_review = False
    txn.review_reason = None

    for action in rule.actions:
        a_type = action["type"]
        value = action.get("value")

        if a_type == "set_category":
            txn.category_id = int(value)
        elif a_type == "set_subcategory":
            txn.subcategory_id = int(value)
        elif a_type == "set_person":
            txn.counterparty_id = int(value)
        elif a_type == "set_account":
            txn.account_id = int(value)
        elif a_type == "set_transaction_type":
            txn.transaction_type = TransactionType(value)
        elif a_type == "mark_transfer":
            txn.transaction_type = TransactionType.TRANSFER
        elif a_type == "mark_income":
            txn.transaction_type = TransactionType.INCOME
        elif a_type == "mark_expense":
            txn.transaction_type = TransactionType.EXPENSE
        elif a_type == "set_label":
            if txn.id is not None:
                exists = session.exec(
                    select(TransactionLabel).where(
                        TransactionLabel.transaction_id == txn.id, TransactionLabel.label_id == int(value)
                    )
                ).first()
                if not exists:
                    session.add(TransactionLabel(transaction_id=txn.id, label_id=int(value), rule_id=rule.id))
        elif a_type == "attach_commitment":
            # Idempotent: re-running rules on an already-attached
            # transaction (e.g. via "apply all rules" after editing a
            # rule) must update the existing link, never pile up a
            # second CommitmentPayment for the same transaction.
            existing = None
            if txn.id is not None:
                existing = session.exec(
                    select(CommitmentPayment).where(
                        CommitmentPayment.commitment_id == int(value), CommitmentPayment.transaction_id == txn.id
                    )
                ).first()
            if existing:
                existing.allocated_amount = txn.amount
                existing.period = _period_for(txn)
                session.add(existing)
            else:
                session.add(
                    CommitmentPayment(
                        commitment_id=int(value),
                        transaction_id=txn.id,
                        period=_period_for(txn),
                        allocated_amount=txn.amount,
                        source_type="phonepe",
                        rule_id=rule.id,
                    )
                )
        elif a_type == "attach_goal":
            existing = None
            if txn.id is not None:
                existing = session.exec(
                    select(GoalContribution).where(
                        GoalContribution.goal_id == int(value), GoalContribution.transaction_id == txn.id
                    )
                ).first()
            if existing:
                existing.amount = txn.amount
                existing.date = txn.date
                session.add(existing)
            else:
                session.add(
                    GoalContribution(
                        goal_id=int(value),
                        transaction_id=txn.id,
                        amount=txn.amount,
                        date=txn.date,
                        rule_id=rule.id,
                    )
                )
        elif a_type == "ignore":
            txn.is_ignored = True
            txn.needs_review = False
        elif a_type == "needs_review":
            txn.needs_review = True
            txn.review_reason = "rule_flagged"
