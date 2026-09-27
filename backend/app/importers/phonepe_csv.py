"""
PhonePe statement CSV parser.

Real PhonePe "Transaction Statement" exports look like this::

    Transaction Statement for +918712387153
    Duration,01 Apr 2023 - 31 Mar 2024

    Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount
    2023-04-13,\t19:10,Paid to Parveen,T2304131910470159507967,310379298536,Debit,XXXXXXXXXX1372,500.00
    ...
    <blank line>
    This is an automatically generated statement. ...
    Visit https://www.phonepe.com/terms-conditions/ ...
    "Do not fall prey to fictitious offers..."
    "The contents of this email and document are confidential..."

Quirks this parser is built to handle, confirmed against real exports:
  * A literal tab character precedes the time value in every data row.
  * UTR is sometimes blank (Wallet/Gift Card instrument rows).
  * The "Credit/debit instrument" column can be a masked account number,
    "Wallet", or "Gift Card".
  * A multi-line legal disclaimer footer follows the data, some lines
    quoted (containing commas) - the csv module handles the quoting
    fine, but these lines don't look like data rows and are skipped.
  * The header line ("Date,Time,...") may appear more than once if
    someone concatenates statements by hand - guarded against.

The parser never raises on a single bad row; malformed rows are
collected and reported so the caller can show them as "failed" in the
import history instead of aborting the whole import.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import datetime, date as date_


@dataclass
class RawPhonePeRow:
    date: date_
    time: str
    narration: str
    reference: str
    utr: str | None
    direction: str  # "Debit" | "Credit"
    instrument: str | None
    amount: float
    raw: dict = field(default_factory=dict)


@dataclass
class ParseResult:
    rows: list[RawPhonePeRow]
    failed_lines: list[tuple[int, str]]  # (line_number, reason)
    statement_phone: str | None
    statement_duration: str | None


HEADER = ["Date", "Time", "Transaction Details", "Transaction ID", "UTR", "Transaction Type", "Credit/debit instrument", "Amount"]


def parse_phonepe_csv(path: str) -> ParseResult:
    rows: list[RawPhonePeRow] = []
    failed: list[tuple[int, str]] = []
    phone = None
    duration = None

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        for line_no, raw_row in enumerate(reader, start=1):
            if not raw_row:
                continue
            first = raw_row[0].strip()

            if first.lower().startswith("transaction statement for"):
                phone = first.replace("Transaction Statement for", "").strip()
                continue
            if first == "Duration" and len(raw_row) > 1:
                duration = raw_row[1].strip()
                continue
            if first == "Date" and len(raw_row) >= 8:
                # header row (possibly repeated) - skip
                continue
            if len(raw_row) < 8:
                # footer / disclaimer / blank-ish lines
                continue

            try:
                dt = datetime.strptime(first, "%Y-%m-%d").date()
                time_str = raw_row[1].strip().lstrip("\t").strip()
                narration = raw_row[2].strip()
                reference = raw_row[3].strip()
                utr = raw_row[4].strip() or None
                direction = raw_row[5].strip()
                instrument = raw_row[6].strip() or None
                amount = float(raw_row[7].strip())

                if direction not in ("Debit", "Credit"):
                    raise ValueError(f"unexpected direction {direction!r}")

                rows.append(
                    RawPhonePeRow(
                        date=dt,
                        time=time_str,
                        narration=narration,
                        reference=reference,
                        utr=utr,
                        direction=direction,
                        instrument=instrument,
                        amount=amount,
                        raw={
                            "date": first,
                            "time": raw_row[1],
                            "narration": narration,
                            "reference": reference,
                            "utr": utr,
                            "direction": direction,
                            "instrument": instrument,
                            "amount": raw_row[7],
                        },
                    )
                )
            except (ValueError, IndexError) as exc:
                failed.append((line_no, f"{exc}: {raw_row}"))

    return ParseResult(rows=rows, failed_lines=failed, statement_phone=phone, statement_duration=duration)


# --- Counterparty extraction from narration ---
_PREFIXES = ("Paid to ", "Received from ", "Paid - ", "Paid- ", "Received - ")


def extract_raw_counterparty(narration: str) -> str:
    """Strip PhonePe's boilerplate prefix to get the raw counterparty text.

    This is the RAW text only - never a resolved Counterparty. Merging
    similar raw strings into one real-world person is a manual,
    explicit action (see services/counterparty_service.py).
    """
    text = narration.strip()
    for prefix in _PREFIXES:
        if text.startswith(prefix):
            return text[len(prefix):].strip()
    return text
