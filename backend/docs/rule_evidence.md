# Evidence behind the seeded auto-matching rules

The seed script (`app/services/seed.py`) creates a small number of
auto-matching rules. Every one of them is backed by a pattern actually
found in the user's real PhonePe statements — nothing here is invented.
Found by grepping `data/sample_statements/PhonePe_Transaction_Statement.csv`
(the 2017–2026 master export) for exact-amount recurring transfers.

| Commitment | Counterparty pattern | Exact amount | Occurrences | Date range observed |
|---|---|---|---|---|
| My Sukanya contribution | contains `3810` | ₹11,500.00 | 22 | 2023-05-12 → 2025-07-01 |
| Home Loan EMI | contains `6735` | ₹18,000.00 | 7 | 2026-02-04 → 2026-09-04 |
| Home Loan Top-Up EMI | contains `4488` | ₹21,000.00 | 3 | 2026-02-04 → 2026-04-02 |
| Union/Asha Home Loan Arrangement | contains `0987` | ₹40,000.00 | 9 | 2026-01-17 → 2026-09-05 |

Reading of the data: the household seems to have taken on a new home
loan around January 2026 (EMI, Top-Up EMI, and the Union/Asha
arrangement all start appearing in Jan/Feb 2026), while the Sukanya
Samriddhi contribution to account `...3810` had already been running
since mid-2023 and stops appearing after July 2025 (the account number
`...3810` is later reused for larger, irregular amounts — ₹21,000 then
₹46,000 — which is exactly the kind of "amount changed from a
recurring payment" case the Review Inbox is built to flag rather than
silently reclassify; see `app/services/review_service.py:detect_recurring_amount_changes`).

**Deliberately NOT auto-matched:**

- The counterparty `ASHA` appears extremely often (both debit and
  credit) with amounts ranging from ₹1 to over ₹1,00,000. This is
  almost certainly related to the Union/Asha arrangement and/or a
  family settlement, but the amounts are far too inconsistent to
  safely auto-attach to a fixed monthly obligation. These transactions
  get a category hint (Home Loan) but are still routed to the Review
  Inbox for a human decision, every time.
- The ₹20,000/month rental-funded leg of the Union/Asha arrangement
  never appears in the PhonePe data at all (rent is presumably
  collected into a different account). It is recorded only via manual
  "Attach Payment" entries with `source_type="rent"` from the
  Commitments page.
- No due dates were invented for any commitment. `due_day` is left
  unset on all seeded commitments; the user can set it once they've
  confirmed the real billing date from their bank/loan statements.

Re-running this analysis (e.g. after importing a fresh year of
statements) is one Python script away:

```python
import csv
from collections import Counter

def load(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [r for r in csv.reader(f) if len(r) == 8 and r[0] != "Date"]

rows = load("data/sample_statements/PhonePe_Transaction_Statement.csv")
target = 18000.0
matches = [r for r in rows if abs(float(r[7]) - target) < 0.01]
print(Counter(r[2] for r in matches))
```
