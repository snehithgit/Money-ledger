from __future__ import annotations

from app.importers.phonepe_csv import RawPhonePeRow, extract_raw_counterparty
from app.importers.dedup import phonepe_fingerprint
from app.models.enums import Direction
from app.models.transaction import Transaction


def normalize_phonepe_row(row: RawPhonePeRow, *, account_id: int, source_file: str, import_batch_id: int) -> Transaction:
    """Map one raw PhonePe CSV row onto the normalized Transaction model.

    Deliberately does NOT set transaction_type, category_id, or
    counterparty_id here - that classification is the rule engine's
    job (Phase 3), applied right after normalization. A freshly
    normalized transaction is always transaction_type=UNKNOWN and
    needs_review=True until something (a rule, or the user) says
    otherwise. This keeps "parse the statement" and "understand the
    statement" as two separate, testable steps.
    """
    direction = Direction.DEBIT if row.direction == "Debit" else Direction.CREDIT
    fingerprint = phonepe_fingerprint(row.reference, row.date, row.direction, row.amount)

    return Transaction(
        date=row.date,
        time=row.time,
        amount=row.amount,
        direction=direction,
        raw_narration=row.narration,
        raw_counterparty=extract_raw_counterparty(row.narration),
        reference=row.reference,
        utr=row.utr,
        raw_instrument=row.instrument,
        source="phonepe_csv",
        source_file=source_file,
        import_batch_id=import_batch_id,
        fingerprint=fingerprint,
        account_id=account_id,
        needs_review=True,
        review_reason="newly imported, not yet classified",
    )
