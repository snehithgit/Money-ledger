from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.rule import Rule
from app.models.transaction import Transaction
from app.rules.conditions import explain_match, matches_all
from app.rules.engine import apply_rules_to_transaction, get_active_rules
from app.schemas.schemas import RuleCreate, RuleTestRequest, RuleUpdate

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("")
def list_rules(session: Session = Depends(get_session)):
    return session.exec(select(Rule).order_by(Rule.priority)).all()


@router.post("")
def create_rule(payload: RuleCreate, session: Session = Depends(get_session)):
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
    session.delete(rule)
    session.commit()
    return {"ok": True}


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
