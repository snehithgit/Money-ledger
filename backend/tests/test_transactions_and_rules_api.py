"""Spec section 47: split invariants, category-change recalculation,
and rule deletion never destroying transaction data - exercised
through the actual HTTP API (FastAPI TestClient) end to end."""
from __future__ import annotations

from datetime import date


def _create_account(client) -> int:
    r = client.post("/api/accounts", json={"name": "Test Wallet", "account_type": "phonepe_wallet"})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _create_category(client, name: str) -> int:
    r = client.post("/api/categories", json={"name": name})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_split_amounts_must_sum_to_parent_amount(client):
    account_id = _create_account(client)
    cat_a = _create_category(client, "Groceries Test")
    cat_b = _create_category(client, "Household Test")

    r = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-01",
            "amount": 1000.0,
            "direction": "debit",
            "account_id": account_id,
            "raw_narration": "Paid to BigBazaar",
            "raw_counterparty": "BigBazaar",
        },
    )
    assert r.status_code == 200
    txn_id = r.json()["id"]

    # Mismatched split total is rejected.
    bad = client.post(f"/api/transactions/{txn_id}/split", json={"splits": [{"amount": 400, "category_id": cat_a}, {"amount": 400, "category_id": cat_b}]})
    assert bad.status_code == 400

    # Correct split total succeeds.
    good = client.post(f"/api/transactions/{txn_id}/split", json={"splits": [{"amount": 600, "category_id": cat_a}, {"amount": 400, "category_id": cat_b}]})
    assert good.status_code == 200

    splits = client.get(f"/api/transactions/{txn_id}/splits").json()
    assert sum(s["amount"] for s in splits) == 1000.0


def test_changing_category_recalculates_category_spend(client):
    account_id = _create_account(client)
    cat_a = _create_category(client, "Dining Test")
    cat_b = _create_category(client, "Travel Test")

    r = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-10",
            "amount": 500.0,
            "direction": "debit",
            "account_id": account_id,
            "raw_narration": "Paid to Restaurant",
            "raw_counterparty": "Restaurant",
            "transaction_type": "expense",
            "category_id": cat_a,
        },
    )
    txn_id = r.json()["id"]

    before = client.get("/api/reports/category-spend", params={"start": "2026-05-01", "end": "2026-06-01"}).json()
    before_map = {row["category_id"]: row["amount"] for row in before}
    assert before_map.get(cat_a) == 500.0

    client.patch(f"/api/transactions/{txn_id}", json={"category_id": cat_b})

    after = client.get("/api/reports/category-spend", params={"start": "2026-05-01", "end": "2026-06-01"}).json()
    after_map = {row["category_id"]: row["amount"] for row in after}
    assert after_map.get(cat_a, 0) == 0
    assert after_map.get(cat_b) == 500.0


def test_deleting_a_rule_never_destroys_transaction_data(client):
    account_id = _create_account(client)
    cat_id = _create_category(client, "Rule Test Category")

    rule = client.post(
        "/api/rules",
        json={
            "name": "Test auto-categorize",
            "conditions": [{"field": "counterparty", "operator": "contains", "value": "specialvendor"}],
            "actions": [{"type": "set_category", "value": cat_id}, {"type": "mark_expense"}],
        },
    ).json()

    txn = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-15",
            "amount": 250.0,
            "direction": "debit",
            "account_id": account_id,
            "raw_narration": "Paid to SpecialVendor",
            "raw_counterparty": "SpecialVendor",
        },
    ).json()

    reapplied = client.post(f"/api/transactions/{txn['id']}/reapply-rules").json()
    assert reapplied["category_id"] == cat_id
    assert reapplied["transaction_type"] == "expense"

    del_resp = client.delete(f"/api/rules/{rule['id']}")
    assert del_resp.status_code == 200

    still_there = client.get(f"/api/transactions/{txn['id']}").json()
    assert still_there["amount"] == 250.0
    assert still_there["raw_narration"] == "Paid to SpecialVendor"
    # The classification the (now-deleted) rule already applied is untouched.
    assert still_there["category_id"] == cat_id
    assert still_there["transaction_type"] == "expense"


def test_reapplying_rules_does_not_duplicate_commitment_payments(client):
    """Re-running the rule engine on an already-classified transaction
    (e.g. via 'apply all rules' after editing a rule) must update its
    existing commitment link, never create a second payment row that
    would double-count toward the commitment's monthly total."""
    account_id = _create_account(client)
    txn = client.post(
        "/api/transactions",
        json={
            "date": "2026-05-04",
            "amount": 18000.0,
            "direction": "debit",
            "account_id": account_id,
            "raw_narration": "Paid to Bank Account XXXXXXX6735",
            "raw_counterparty": "Bank Account XXXXXXX6735",
        },
    ).json()

    client.post(f"/api/transactions/{txn['id']}/reapply-rules")
    client.post(f"/api/transactions/{txn['id']}/reapply-rules")
    client.post("/api/rules/apply-all")

    commitments = client.get("/api/commitments", params={"period": "2026-05"}).json()
    emi = next(c for c in commitments if c["name"] == "Home Loan EMI")
    assert emi["paid_amount"] == 18000.0  # not 36000 or 54000
    assert emi["status"] == "completed"
    assert len(emi["payments"]) == 1


def test_rule_test_endpoint_reports_matched_count_without_applying_anything(client):
    account_id = _create_account(client)
    for i in range(3):
        client.post(
            "/api/transactions",
            json={
                "date": "2026-05-20",
                "amount": 99.0,
                "direction": "debit",
                "account_id": account_id,
                "raw_narration": f"Paid to TestShop{i}",
                "raw_counterparty": f"TestShop{i}",
            },
        )
    result = client.post("/api/rules/test", json={"conditions": [{"field": "amount", "operator": "equals", "value": 99.0}]}).json()
    assert result["matched_count"] == 3
