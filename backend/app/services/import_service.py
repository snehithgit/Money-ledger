"""
Import orchestration: Importer -> Normalizer -> Duplicate detector ->
Rule engine -> Commitment matcher (spec section 12 pipeline).

Every step commits to the SAME import batch record so import history
(section 14) is always accurate, and duplicate rows never touch the
rule engine or counterparty tables at all - they're skipped before any
of that runs.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import settings
from app.importers.phonepe_csv import parse_phonepe_csv
from app.importers.normalizer import normalize_phonepe_row
from app.models.account import Account
from app.models.enums import AccountType, ImportStatus
from app.models.importbatch import ImportBatch
from app.models.transaction import Transaction
from app.rules.engine import apply_rules_to_transaction, get_active_rules
from app.services.counterparty_service import resolve_counterparty


def get_or_create_phonepe_account(session: Session) -> Account:
    acct = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    if acct:
        return acct
    acct = Account(name="PhonePe", account_type=AccountType.PHONEPE_WALLET, institution="PhonePe")
    session.add(acct)
    session.flush()
    return acct


def import_phonepe_csv(session: Session, upload_path: str, original_filename: str, account_id: int | None = None) -> ImportBatch:
    account = session.get(Account, account_id) if account_id else get_or_create_phonepe_account(session)
    if account is None:
        raise ValueError("account not found")

    safe_name = Path(original_filename).name
    archive_path = settings.raw_imports_dir / safe_name
    # never overwrite a previous archive of the same filename
    counter = 1
    while archive_path.exists():
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        archive_path = settings.raw_imports_dir / f"{stem}__{counter}{suffix}"
        counter += 1
    shutil.copyfile(upload_path, archive_path)

    batch = ImportBatch(filename=original_filename, archived_path=str(archive_path), account_id=account.id)
    session.add(batch)
    session.flush()

    try:
        result = parse_phonepe_csv(upload_path)
    except Exception as exc:  # pragma: no cover - defensive
        batch.status = ImportStatus.FAILED
        batch.error_message = str(exc)
        session.add(batch)
        session.commit()
        return batch

    rules = get_active_rules(session)

    found = len(result.rows)
    new_count = 0
    dup_count = 0
    failed_count = len(result.failed_lines)
    review_count = 0

    existing_fingerprints: set[str] = set(session.exec(select(Transaction.fingerprint)).all())
    existing_phonepe_refs: dict[str, str] = {
        ref: fp for ref, fp in session.exec(
            select(Transaction.reference, Transaction.fingerprint).where(Transaction.source == "phonepe_csv")
        ).all()
    }

    for row in result.rows:
        txn = normalize_phonepe_row(
            row, account_id=account.id, source_file=original_filename, import_batch_id=batch.id
        )

        if txn.fingerprint in existing_fingerprints:
            dup_count += 1
            continue
        if txn.reference in existing_phonepe_refs and existing_phonepe_refs[txn.reference] != txn.fingerprint:
            # A stable PhonePe transaction ID appearing with different facts is
            # a source conflict, not a new transaction. Preserve the old row.
            failed_count += 1
            continue

        txn.counterparty_id = resolve_counterparty(session, txn.raw_counterparty).id

        session.add(txn)
        session.flush()  # assign txn.id so rule actions (labels/commitments) can reference it

        apply_rules_to_transaction(session, txn, rules)
        session.add(txn)

        existing_fingerprints.add(txn.fingerprint)
        existing_phonepe_refs[txn.reference] = txn.fingerprint
        new_count += 1
        if txn.needs_review:
            review_count += 1

    batch.transactions_found = found
    batch.transactions_new = new_count
    batch.transactions_duplicate = dup_count
    batch.transactions_failed = failed_count
    batch.transactions_needs_review = review_count
    batch.status = ImportStatus.SUCCESS if failed_count == 0 else ImportStatus.PARTIAL
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return batch
