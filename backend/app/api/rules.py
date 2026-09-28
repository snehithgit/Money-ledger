from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.rule import Rule
from app.models.transaction import Transaction
from app.rules.conditions import explain_match, matches_all
from app.rules.engine import apply_rules_to_transaction, clear_rule_derived, get_active_rules
from app.schemas.schemas import RuleCreate, RuleTestRequest, RuleUpdate

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _validate_rule_targets(session: Session, actions: list[dict]) -> None:
    from app.models.account import Account
    from app.models.category import Category
    from app.models.commitment import RecurringCommitment
    from app.models.counterparty import Counterparty
    from app.models.goal import Goal
    from app.models.label import Label
    from app.models.enums import TransactionType

    targets = {
        "set_category": Category, "set_subcategory": Category, "set_label": Label,
        "set_person": Counterparty, "set_account": Account,
        "attach_commitment": RecurringCommitment, "attach_goal": Goal,
    }
    for action in actions:
        a_type, value = action.get("type"), action.get("value")
        if a_type in targets:
            try: obj_id = int(value)
            except (TypeError, ValueError): raise HTTPException(400, f"{a_type} requires a numeric id")
            if session.get(targets[a_type], obj_id) is None:
                raise HTTPException(400, f"{a_type} target {obj_id} does not exist")
        elif a_type == "set_transaction_type":
            try: TransactionType(value)
            except ValueError: raise HTTPException(400, f"invalid transaction type: {value}")


@router.get("")
def list_rules(session: Session = Depends(get_session)):
    return session.exec(select(Rule).order_by(Rule.priority)).all()


@router.post("")
def create_rule(payload: RuleCreate, session: Session = Depends(get_session)):
    _validate_rule_targets(session, [a.model_dump() for a in payload.actions])
    rule = Rule(
        name=payload.name,
        description=payload.description,
        conditions=[c.model_dump() for c in payload.conditions],
        actions=[a.model_dump() for a in payload.actions],
        priority=payload.priority,
        is_active=payload.is_active,
    )
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.get("/{rule_id}")
def get_rule(rule_id: int, session: Session = Depends(get_session)):
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(404, "rule not found")
    return rule


@router.patch("/{rule_id}")
def update_rule(rule_id: int, payload: RuleUpdate, session: Session = Depends(get_session)):
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(404, "rule not found")
    data = payload.model_dump(exclude_unset=True)
    if payload.actions is not None:
        _validate_rule_targets(session, [a.model_dump() for a in payload.actions])
    if "conditions" in data and data["conditions"] is not None:
        data["conditions"] = [c if isinstance(c, dict) else c.model_dump() for c in data["conditions"]]
    if "actions" in data and data["actions"] is not None:
        data["actions"] = [a if isinstance(a, dict) else a.model_dump() for a in data["actions"]]
    for k, v in data.items():
        setattr(rule, k, v)
    session.add(rule)
    session.commit()
    session.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, session: Session = Depends(get_session)):
    """Deleting a rule never touches the transactions it already
    classified - raw + derived transaction data is untouched (spec
    section 47: reverting a rule must not destroy transaction data).
    It only stops the rule from matching future/re-evaluated transactions.
    """
    rule = session.get(Rule, rule_id)
    if not rule:
        raise HTTPException(404, "rule not found")
    affected = session.exec(select(Transaction).where(Transaction.matched_rule_id == rule_id)).all()
    for txn in affected:
        clear_rule_derived(session, txn)
        txn.matched_rule_id = None
        txn.match_explanation = None
        txn.classification_source = "manual"  # freeze the visible classification the user already saw
        session.add(txn)
    # Defensive cleanup for any orphanable derived rows carrying this rule id.
    from app.models.label import TransactionLabel
    from app.models.commitment import CommitmentPayment
    from app.models.goal import GoalContribution
    for model in (TransactionLabel, CommitmentPayment, GoalContribution):
        for row in session.exec(select(model).where(model.rule_id == rule_id)).all():
            session.delete(row)
    session.flush()
    session.delete(rule)
    session.commit()
    return {"ok": True, "transactions_preserved": len(affected)}


@router.post("/test")
def test_rule(payload: RuleTestRequest, session: Session = Depends(get_session)):
    conditions = [c.model_dump() for c in payload.conditions]
    txns = session.exec(select(Transaction).order_by(Transaction.date.desc())).all()
    matched = [t for t in txns if matches_all(t, conditions)]
    return {
        "matched_count": len(matched),
        "explanation": explain_match(conditions),
        "sample": [
            {"id": t.id, "date": t.date.isoformat(), "amount": t.amount, "raw_narration": t.raw_narration}
            for t in matched[: payload.limit]
        ],
    }


@router.post("/apply-all")
def apply_all_rules(session: Session = Depends(get_session)):
    """Re-run every active rule against every transaction. Used after
    creating/editing a rule so existing (not just future) transactions
    benefit from it."""
    rules = get_active_rules(session)
    for r in rules:
        r.matched_count = 0
        session.add(r)
    txns = session.exec(select(Transaction).where(Transaction.is_ignored == False)).all()  # noqa: E712
    changed = 0
    for t in txns:
        before = (t.matched_rule_id, t.transaction_type, t.needs_review)
        apply_rules_to_transaction(session, t, rules)
        session.add(t)
        after = (t.matched_rule_id, t.transaction_type, t.needs_review)
        if before != after:
            changed += 1
    session.commit()
    return {"evaluated": len(txns), "changed": changed}
