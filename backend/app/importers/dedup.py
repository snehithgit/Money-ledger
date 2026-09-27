"""
Fingerprinting for idempotent imports (spec sections 14 & 47).

The fingerprint is built from the PhonePe "Transaction ID" (`reference`),
which real exports confirm is a stable, globally-unique identifier for
a transaction - the same transaction has the same Transaction ID
whether it appears in the multi-year master statement or a
single-fiscal-year statement. Date/direction/amount are folded in too
as a defence-in-depth check, not because they're expected to differ.

Importing the same statement twice, or two statements whose date
ranges overlap, must therefore produce zero duplicate rows: the second
import computes the same fingerprints and every one of them is caught
by the unique constraint on transaction.fingerprint before insert.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date as date_


def phonepe_fingerprint(reference: str, date: date_, direction: str, amount: float) -> str:
    key = f"phonepe|{reference}|{date.isoformat()}|{direction}|{amount:.2f}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def manual_fingerprint() -> str:
    """Manual entries are never deduplicated against each other or
    against imports - each represents a distinct user action."""
    return f"manual|{uuid.uuid4().hex}"
