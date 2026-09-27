"""
Counterparty resolution and alias merging.

Rule: a brand-new raw counterparty string ALWAYS gets its own new
Counterparty + CounterpartyAlias row the first time it's seen. Nothing
here ever merges two different raw strings into one Counterparty based
on similarity - that is exclusively a manual action via
`merge_counterparties` (spec section 45: "never auto-merge people just
because names look similar").
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models.counterparty import Counterparty, CounterpartyAlias
from app.models.transaction import Transaction


def resolve_counterparty(session: Session, raw_text: str) -> Counterparty:
    """Return the Counterparty for this exact raw string, creating a
    new one (and its first alias) if this exact string hasn't been
    seen before."""
    raw_text = raw_text.strip()
    alias = session.exec(select(CounterpartyAlias).where(CounterpartyAlias.raw_text == raw_text)).first()
    if alias:
        return session.get(Counterparty, alias.counterparty_id)

    cp = Counterparty(display_name=raw_text)
    session.add(cp)
    session.flush()  # get cp.id without committing
    session.add(CounterpartyAlias(raw_text=raw_text, counterparty_id=cp.id))
    return cp


def merge_counterparties(session: Session, keep_id: int, merge_id: int) -> Counterparty:
    """Explicit, user-initiated merge: repoint every alias and every
    transaction from `merge_id` onto `keep_id`, then delete the now-empty
    counterparty. This is the ONLY way two counterparties ever combine.
    """
    if keep_id == merge_id:
        raise ValueError("cannot merge a counterparty into itself")

    keep = session.get(Counterparty, keep_id)
    merge = session.get(Counterparty, merge_id)
    if not keep or not merge:
        raise ValueError("counterparty not found")

    aliases = session.exec(select(CounterpartyAlias).where(CounterpartyAlias.counterparty_id == merge_id)).all()
    for a in aliases:
        a.counterparty_id = keep_id
        session.add(a)

    txns = session.exec(select(Transaction).where(Transaction.counterparty_id == merge_id)).all()
    for t in txns:
        t.counterparty_id = keep_id
        session.add(t)

    session.delete(merge)
    session.flush()
    return keep
