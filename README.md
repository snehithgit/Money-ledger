# Personal Finance Tracker

A private, offline-first finance tracker built around **your real PhonePe
statements** plus the specific things you actually need to track: the
Sukanya Samriddhi contributions, the home loan EMI and top-up EMI, and
the Union/Asha home loan arrangement. No cloud account, no telemetry, no
ads. Everything lives in one SQLite file on your own machine.

This build covers **Phases 1–4** of the project spec:

1. **Foundation** — accounts, transactions, categories, labels, counterparties, manual entry, responsive UI.
2. **PhonePe Import** — CSV parser, duplicate-proof import, import history.
3. **Rule Engine** — deterministic auto-categorization, explainable, with a Review Inbox for anything ambiguous.
4. **Personal Trackers** — the recurring-commitment engine, seeded with your five specific commitments.

Dashboard/analytics charts, budgets/goals UI polish, and backup/PIN/export
(Phases 5–7) are intentionally **not** built yet — see [What's not built yet](#whats-not-built-yet-phases-5-7).

---

## 1. Installation & first run

Requirements: Docker and Docker Compose. Nothing else.

```bash
cd finance-tracker
docker compose up -d --build
```

Then open:

- **App:** http://localhost:8080
- **API docs (Swagger):** http://localhost:8000/docs

First launch automatically creates the database, the default category
tree, default labels, four starter accounts (PhonePe, Cash, Wife's
Account, Rental Income), the Sukanya Samriddhi goal, all five seeded
commitments, and a handful of evidence-based auto-matching rules (see
`backend/docs/rule_evidence.md` for exactly what evidence backs each
one — nothing is invented).

## 2. Starting / stopping

```bash
docker compose stop        # stop containers, keep data
docker compose up -d       # start again
docker compose down        # stop and remove containers (data volume is untouched)
docker compose logs -f backend   # tail backend logs
```

## 3. Importing your PhonePe statement

1. Go to **Imports** in the app (or **More → Imports** on mobile).
2. Choose your PhonePe "Transaction Statement" CSV export and click **Import**.
3. The import history table shows how many transactions were found, how
   many were new, how many were duplicates (safely skipped), and how
   many need review.

**Importing the same statement twice, or an overlapping statement (e.g.
your multi-year export and a single fiscal year that's a subset of it),
is always safe** — duplicates are detected by a fingerprint built from
PhonePe's own Transaction ID, not by filename or row order, and are
never inserted twice.

Sample statements (your real exports, provided when this app was built)
are in `data/sample_statements/` if you want to re-import or test with
them again.

## 4. Reviewing transactions

Anything the rule engine can't confidently classify lands in
**Review Inbox**, grouped by why it's there:

- *No rule matched* — a genuinely new counterparty/pattern.
- *Rule conflict* — two rules both matched; the app never guesses which one wins.
- *Flagged by a rule* — e.g. the "ASHA" counterparty rule, which categorizes but always asks for confirmation because the amounts are too inconsistent to trust automatically.

From there you can mark it a transfer, ignore it, or open **Categorize**
to set its category/type/notes, or split it across categories.

## 5. Accounts

**Accounts** page → **+ Add account**. Give it a name and pick a type
(bank savings, salary account, cash, wallet, credit card, rental, loan,
other bank, etc). Balances are computed from opening balance + every
transaction posted to that account.

## 6. Categories

**Categories** page → add a top-level category or a subcategory of an
existing one. The seeded default tree (Income, Home, Food, Transport,
Shopping, Family, Education, Medical, Entertainment, Travel, Loans,
Savings, Transfers, Cash, Uncategorized) is fully editable — nothing is
locked except that the seeded ones can't be *deleted* (rename them
instead, so nothing that depends on them silently breaks).

## 7. Creating rules

**Rules** page → **+ New rule**. A rule has:

- **Conditions** (all must match): counterparty, narration, UPI ID, amount, direction, account, day of month, transaction type, bank/instrument, or reference — each with an operator (equals / contains / range / greater than / less than).
- **Actions**: set category/subcategory/person/account/transaction type, attach to a commitment or goal, mark as transfer/income/expense, ignore, or force needs-review.

Use **Test against existing transactions** before saving to see exactly
how many transactions would match. After saving, use **Re-apply all
rules** to run every active rule against every existing transaction
(useful after tightening a rule) — this is idempotent, so running it
repeatedly never double-counts a commitment payment.

If two active rules both match the same transaction, nothing is applied
automatically — it goes to the Review Inbox as a conflict instead.
Deleting a rule never touches transactions it already classified.

## 8. Managing people (counterparties)

**People** page lists everyone you've paid or received money from, with
total paid/received/net balance. Real statements spell the same person's
name differently — use **Merge duplicates** to pick two entries that are
actually the same person; this is always a manual, explicit action and
is never done automatically based on name similarity.

## 9. Creating recurring commitments

**Commitments** page shows every active commitment for the selected
month, grouped (e.g. "Home / Property Finance", "Sukanya Samriddhi").
Click a commitment to expand it and see every payment recorded against
it that period, and to log a manual contribution (for money that never
appears in your PhonePe statement — e.g. your wife's Sukanya
contribution, or the rent-funded leg of the home loan arrangement).

A commitment can be satisfied by **multiple transactions from multiple
sources** in the same period — e.g. the Union/Asha arrangement: ₹20,000
from rent + ₹15,000 + ₹5,000 via PhonePe all count toward the same
₹40,000/month obligation. Status is computed automatically: Pending,
Partial, Completed, Overpaid, or Needs Review.

## 10. The Sukanya Samriddhi tracker

Seeded automatically:

- **My Sukanya contribution** — ₹11,500/month, auto-matched to PhonePe transfers to `...3810` when the amount is exactly ₹11,500 (confirmed from your real statement: 22 occurrences, May 2023–Jul 2025).
- **Wife Sukanya contribution** — ₹1,000/month, manual-only (auto-deducted from her own account, so it's confirmed by hand each month from the Commitments page, never assumed to come from your account).

Both feed the **Sukanya Samriddhi** goal on the **Goals** page, which
shows combined year-to-date progress without double-counting either
contribution.

## 11. The home loan trackers

Three separate, never-combined trackers, all under the "Home / Property
Finance" group:

- **Home Loan EMI** — ₹18,000/month (auto-matched to `...6735` at exactly ₹18,000).
- **Home Loan Top-Up EMI** — ₹21,000/month (auto-matched to `...4488` at exactly ₹21,000). Tracked completely independently of the EMI above, even though both are home-loan-related.
- **Union/Asha Home Loan Arrangement** — ₹40,000/month total, no single hard-coded recipient. Auto-matched when a single PhonePe payment of exactly ₹40,000 goes to `...0987`; otherwise, log the rent-funded portion and any other contribution manually from the Commitments page.

See `backend/docs/rule_evidence.md` for the exact evidence behind each
auto-match (counterparty pattern, amount, occurrence count, date range).

## 12. Updating the app

```bash
git pull   # if you're tracking this in your own git remote
docker compose up -d --build
```

Your data lives in the `finance_tracker_data` Docker volume, not in the
containers, so rebuilding never loses anything.

## 13. Where your database lives

Inside the backend container: `/data/finance.db` (SQLite), with raw
imported statement files archived alongside it in `/data/raw_imports/`
(never overwritten, never deleted by the app). This directory is the
Docker named volume `finance_tracker_data`.

To back it up manually right now (proper backup/restore UI is a later
phase — see below):

```bash
docker cp $(docker compose ps -q backend):/data ./finance-backup-$(date +%F)
```

To restore, stop the app, copy files back into the volume, and start
again:

```bash
docker compose down
docker run --rm -v finance_tracker_data:/data -v $(pwd)/finance-backup-2026-01-01:/backup alpine \
  sh -c "cp -r /backup/* /data/"
docker compose up -d
```

---

## What's not built yet (Phases 5–7)

By explicit choice, this build stops after Phase 4. Not yet built:

- **Dashboard charts & full analytics** (Phase 5) — the Dashboard page shows this month's cash flow, active commitment statuses, and spend-by-type as plain numbers/cards, not charts.
- **Budget planner UI, polished Goals UI, scheduled payments** (Phase 6) — the `budgets` table exists in the schema; there's no UI for it yet.
- **In-app backup/restore, CSV/XLSX/JSON/PDF export, PIN/auto-lock** (Phase 7) — use the `docker cp` approach above for backups in the meantime.

The database schema already has the tables these need (see
`backend/app/models/`), so none of this requires a breaking schema
change later — it's additive.

## Architecture

```
backend/   FastAPI + SQLModel + SQLite
  app/models/       one file per table (SQLModel table classes)
  app/schemas/       request/response Pydantic schemas
  app/importers/     PhonePe CSV parser, normalizer, dedup fingerprinting
  app/rules/         deterministic rule condition/action engine
  app/services/       counterparty resolution, import orchestration,
                       centralized financial calculations, seed data,
                       review inbox
  app/api/            FastAPI routers (one per resource)
  alembic/            schema migration baseline (app self-initializes
                       its schema on first run; Alembic is here for
                       future changes)
  tests/              pytest suite covering the spec's critical tests
                       (idempotent import, transfer exclusion, EMI vs
                       top-up EMI separation, partial payments, rule
                       conflicts, split invariants, rule-delete safety…)

frontend/  React + TypeScript + Vite + Tailwind
  src/pages/          one file per screen
  src/components/     Layout (desktop sidebar / mobile bottom nav),
                       Quick Add modal, Transaction edit/split modal
  src/api/client.ts   thin fetch wrapper + shared types

docker-compose.yml    backend + frontend, one named volume for all data
```

### Running the backend test suite

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -v
```

(These tests run against an isolated in-memory SQLite database and
never touch your real `/data` volume.)
# Money-ledger
