from __future__ import annotations

from datetime import date
from sqlmodel import select

from app.models.account import Account
from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.models.enums import AccountType, Direction, TransactionType
from app.models.goal import GoalContribution
from app.models.transaction import Transaction, TransactionSplit
from app.rules.engine import apply_rules_to_transaction, get_active_rules
from app.services.calculations import calculate_category_spend, calculate_commitment_status
from app.services.seed import seed_all


def _txn(session, account_id: int, amount=100.0, counterparty="Manual Vendor"):
    t = Transaction(
        date=date(2026, 9, 1), amount=amount, direction=Direction.DEBIT,
        raw_narration=f"Paid to {counterparty}", raw_counterparty=counterparty,
        reference=f"r-{counterparty}-{amount}", fingerprint=f"f-{counterparty}-{amount}",
        account_id=account_id, source="manual", transaction_type=TransactionType.EXPENSE,
        needs_review=False, classification_source="manual",
    )
    session.add(t); session.flush(); return t


def test_apply_all_does_not_overwrite_manual_classification(client):
    aid = client.post("/api/accounts", json={"name":"Manual A","account_type":"bank_savings"}).json()["id"]
    txn = client.post("/api/transactions", json={
        "date":"2026-09-01","amount":123,"direction":"debit","account_id":aid,
        "raw_narration":"Paid to Human Reviewed","raw_counterparty":"Human Reviewed",
        "transaction_type":"expense","notes":"manual",
    }).json()
    client.post("/api/rules/apply-all")
    after = client.get(f"/api/transactions/{txn['id']}").json()
    assert after["transaction_type"] == "expense"
    assert after["classification_source"] == "manual"
    assert after["needs_review"] is False


def test_auto_confirm_status_is_read_only(session):
    seed_all(session)
    c = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Wife Sukanya contribution")).first()
    before = session.exec(select(CommitmentPayment).where(CommitmentPayment.commitment_id == c.id)).all()
    status = calculate_commitment_status(session, c.id, "2026-09")
    after = session.exec(select(CommitmentPayment).where(CommitmentPayment.commitment_id == c.id)).all()
    assert status["status"] == "completed"
    assert status["virtual_auto_confirm"] is True
    assert len(after) == len(before) == 0


def test_commitment_allocations_cannot_exceed_transaction(client):
    aid = client.post("/api/accounts", json={"name":"Alloc A","account_type":"bank_savings"}).json()["id"]
    txn = client.post("/api/transactions", json={"date":"2026-09-01","amount":10000,"direction":"debit","account_id":aid,"raw_narration":"Loan","raw_counterparty":"Loan"}).json()
    cs = client.get("/api/commitments", params={"period":"2026-09"}).json()
    c1, c2 = cs[0], cs[1]
    assert client.post(f"/api/commitments/{c1['commitment_id']}/payments", json={"transaction_id":txn["id"],"period":"2026-09","allocated_amount":6000,"source_type":"phonepe"}).status_code == 200
    bad = client.post(f"/api/commitments/{c2['commitment_id']}/payments", json={"transaction_id":txn["id"],"period":"2026-09","allocated_amount":5000,"source_type":"phonepe"})
    assert bad.status_code == 400


def test_transfer_is_balanced_and_linked(client):
    a = client.post("/api/accounts", json={"name":"From","account_type":"bank_savings","opening_balance":5000}).json()
    b = client.post("/api/accounts", json={"name":"To","account_type":"bank_savings","opening_balance":1000}).json()
    pair = client.post("/api/transactions/transfer", json={"date":"2026-09-01","amount":750,"source_account_id":a["id"],"destination_account_id":b["id"]}).json()
    assert pair["source"]["linked_transaction_id"] == pair["destination"]["id"]
    assert pair["destination"]["linked_transaction_id"] == pair["source"]["id"]
    accounts = {x["id"]: x for x in client.get("/api/accounts").json()}
    assert accounts[a["id"]]["balance"] == 4250
    assert accounts[b["id"]]["balance"] == 1750
    assert sum(x["balance"] for x in accounts.values() if x["id"] in {a["id"], b["id"]}) == 6000


def test_split_categories_drive_category_report(session):
    a = Account(name="A", account_type=AccountType.BANK_SAVINGS); session.add(a); session.flush()
    from app.models.category import Category
    c1=Category(name="C1"); c2=Category(name="C2"); session.add(c1); session.add(c2); session.flush()
    t=_txn(session,a.id,1000); session.add(TransactionSplit(transaction_id=t.id, amount=600, category_id=c1.id)); session.add(TransactionSplit(transaction_id=t.id, amount=400, category_id=c2.id)); session.commit()
    rows=calculate_category_spend(session,date(2026,9,1),date(2026,10,1)); m={r["category_id"]:r["amount"] for r in rows}
    assert m[c1.id] == 600 and m[c2.id] == 400


def test_seed_identity_survives_rename(session):
    seed_all(session)
    c=session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first(); original_id=c.id
    c.name="Renamed EMI"; session.add(c); session.commit()
    seed_all(session)
    assert session.get(RecurringCommitment, original_id).name == "Renamed EMI"
    assert len(session.exec(select(RecurringCommitment).where(RecurringCommitment.id == original_id)).all()) == 1
    assert session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first() is None


def test_trend_endpoint_exists(client):
    r=client.get("/api/reports/trend", params={"months":6})
    assert r.status_code == 200
    assert len(r.json()) == 6
