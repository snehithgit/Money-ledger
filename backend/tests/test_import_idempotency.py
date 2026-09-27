"""Spec section 47: importing the same statement twice (or overlapping
statements) must create zero duplicate transactions."""
from __future__ import annotations

import textwrap

from sqlmodel import select

from app.models.transaction import Transaction
from app.services.import_service import import_phonepe_csv

SAMPLE_CSV = textwrap.dedent(
    """\
    Transaction Statement for +919999999999
    Duration,01 Apr 2024 - 30 Apr 2024

    Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount
    2024-04-05,\t10:15,Paid to Bank Account XXXXXXX6735,T20240405101512345678,111111111111,Debit,XXXXXXXXXX1234,18000.00
    2024-04-10,\t09:00,Paid to Swiggy,T20240410090012345678,222222222222,Debit,XXXXXXXXXX1234,450.00
    2024-04-15,\t18:30,Received from PhonePe,T20240415183012345678,,Credit,Wallet,2.50

    This is an automatically generated statement.
    """
)


def _write_csv(tmp_path, name="statement.csv", content=SAMPLE_CSV):
    path = tmp_path / name
    path.write_text(content, encoding="utf-8")
    return str(path)


def test_reimporting_same_file_produces_zero_new_transactions(session, tmp_path):
    path = _write_csv(tmp_path)

    batch1 = import_phonepe_csv(session, path, "statement.csv")
    assert batch1.transactions_found == 3
    assert batch1.transactions_new == 3
    assert batch1.transactions_duplicate == 0

    batch2 = import_phonepe_csv(session, path, "statement.csv")
    assert batch2.transactions_found == 3
    assert batch2.transactions_new == 0
    assert batch2.transactions_duplicate == 3

    all_txns = session.exec(select(Transaction)).all()
    assert len(all_txns) == 3  # not 6


def test_overlapping_statement_produces_zero_new_transactions(session, tmp_path):
    """A second file that's a subset of the first (as the user's real
    yearly PhonePe exports are subsets of the master export) must not
    create duplicates either - dedup is keyed on the transaction
    reference, not the filename."""
    full_path = _write_csv(tmp_path, "full.csv", SAMPLE_CSV)
    import_phonepe_csv(session, full_path, "full.csv")

    subset_csv = textwrap.dedent(
        """\
        Transaction Statement for +919999999999
        Duration,01 Apr 2024 - 10 Apr 2024

        Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount
        2024-04-05,\t10:15,Paid to Bank Account XXXXXXX6735,T20240405101512345678,111111111111,Debit,XXXXXXXXXX1234,18000.00
        2024-04-10,\t09:00,Paid to Swiggy,T20240410090012345678,222222222222,Debit,XXXXXXXXXX1234,450.00
        """
    )
    subset_path = _write_csv(tmp_path, "subset.csv", subset_csv)
    batch2 = import_phonepe_csv(session, subset_path, "subset.csv")

    assert batch2.transactions_new == 0
    assert batch2.transactions_duplicate == 2

    all_txns = session.exec(select(Transaction)).all()
    assert len(all_txns) == 3


def test_raw_data_is_archived_and_never_overwritten(session, tmp_path):
    path = _write_csv(tmp_path)
    import_phonepe_csv(session, path, "statement.csv")
    import_phonepe_csv(session, path, "statement.csv")  # same filename again

    from pathlib import Path

    from app.core.config import settings

    archived = list(Path(settings.raw_imports_dir).glob("statement*.csv"))
    assert len(archived) == 2  # second archive got a suffix, first was never overwritten
