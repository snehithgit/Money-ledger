"""Spec section 47: the rule engine must never guess when it shouldn't,
and must correctly separate the ₹18,000 EMI from the ₹21,000 Top-Up EMI
even though a naive "home loan" rule might be tempted to merge them."""
from __future__ import annotations

from datetime import date

from sqlmodel import select

from app.models.account import Account
from app.models.commitment import RecurringCommitment
from app.models.enums import AccountType, Direction, TransactionType
from app.models.transaction import Transaction
from app.rules.engine import apply_rules_to_transaction, get_active_rules
from app.services.calculations import calculate_cashflow, calculate_commitment_status
from app.services.seed import seed_all


def _make_txn(session, account_id, **kwargs) -> Transaction:
    defaults = dict(
        date=date(2026, 3, 4),
        amount=100.0,
        direction=Direction.DEBIT,
        raw_narration="Paid to Someone",
        raw_counterparty="Someone",
        reference=f"ref-{kwargs.get('amount', 100.0)}-{kwargs.get('raw_counterparty', 'x')}",
        fingerprint=f"fp-{id(kwargs)}-{kwargs.get('amount')}",
        account_id=account_id,
        source="phonepe_csv",
    )
    defaults.update(kwargs)
    if "fingerprint" not in kwargs:
        defaults["fingerprint"] = f"fp-{defaults['reference']}"
    txn = Transaction(**defaults)
    session.add(txn)
    session.flush()
    return txn


def test_emi_and_topup_emi_are_never_combined(session):
    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    emi_txn = _make_txn(
        session, phonepe.id,
        amount=18000.0, raw_narration="Paid to Bank Account XXXXXXX6735",
        raw_counterparty="Bank Account XXXXXXX6735", reference="R-EMI-1",
    )
    topup_txn = _make_txn(
        session, phonepe.id,
        amount=21000.0, raw_narration="Paid to Bank Account XXXXXXX4488",
        raw_counterparty="Bank Account XXXXXXX4488", reference="R-TOPUP-1",
    )

    apply_rules_to_transaction(session, emi_txn, rules)
    apply_rules_to_transaction(session, topup_txn, rules)
    session.commit()

    emi = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first()
    topup = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan Top-Up EMI")).first()

    period = "2026-03"
    emi_status = calculate_commitment_status(session, emi.id, period)
    topup_status = calculate_commitment_status(session, topup.id, period)

    assert emi_status["status"] == "completed"
    assert emi_status["paid_amount"] == 18000.0
    assert topup_status["status"] == "completed"
    assert topup_status["paid_amount"] == 21000.0
    # Critically: the EMI commitment must NOT have absorbed the top-up payment or vice versa.
    assert len(emi_status["payments"]) == 1
    assert len(topup_status["payments"]) == 1


def test_sukanya_contribution_auto_matches_and_is_never_an_expense(session):
    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    txn = _make_txn(
        session, phonepe.id,
        amount=11500.0, date=date(2024, 6, 4),
        raw_narration="Paid to Bank Account XXXXXXX3810",
        raw_counterparty="Bank Account XXXXXXX3810", reference="R-SUK-1",
    )
    apply_rules_to_transaction(session, txn, rules)
    session.commit()

    assert txn.transaction_type == TransactionType.SAVINGS
    assert txn.needs_review is False

    my_sukanya = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "My Sukanya contribution")).first()
    status = calculate_commitment_status(session, my_sukanya.id, "2024-06")
    assert status["status"] == "completed"
    assert status["paid_amount"] == 11500.0

    # And it must never show up as "Expense" spend, per spec section 45.
    cashflow = calculate_cashflow(session, date(2024, 6, 1), date(2024, 7, 1))
    assert cashflow["by_out_type"].get("expense", 0) == 0
    assert cashflow["by_out_type"]["savings"] == 11500.0


def test_unclassified_transaction_goes_to_review_not_silently_categorized(session):
    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    txn = _make_txn(
        session, phonepe.id,
        amount=777.0, raw_narration="Paid to Some Random Shop",
        raw_counterparty="Some Random Shop", reference="R-RANDOM-1",
    )
    apply_rules_to_transaction(session, txn, rules)
    session.commit()

    assert txn.needs_review is True
    assert txn.transaction_type == TransactionType.UNKNOWN
    assert txn.review_reason == "no_rule_matched"

    from app.services.review_service import list_review_inbox

    inbox = list_review_inbox(session)
    ids_in_inbox = {t["id"] for group in inbox["groups"] for t in group["transactions"]}
    assert txn.id in ids_in_inbox


def test_rule_conflict_is_flagged_not_guessed(session):
    """Two rules matching the same transaction must never silently pick
    a winner - the transaction goes to review with reason rule_conflict."""
    from app.models.rule import Rule

    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()

    rule_a = Rule(
        name="Conflict A",
        conditions=[{"field": "amount", "operator": "equals", "value": 555.0}],
        actions=[{"type": "set_transaction_type", "value": "expense"}],
    )
    rule_b = Rule(
        name="Conflict B",
        conditions=[{"field": "direction", "operator": "equals", "value": "debit"}, {"field": "amount", "operator": "range", "value": [500, 600]}],
        actions=[{"type": "set_transaction_type", "value": "family_contribution"}],
    )
    session.add(rule_a)
    session.add(rule_b)
    session.flush()

    txn = _make_txn(session, phonepe.id, amount=555.0, reference="R-CONFLICT-1")

    from app.rules.engine import get_active_rules

    apply_rules_to_transaction(session, txn, get_active_rules(session))
    session.commit()

    assert txn.needs_review is True
    assert txn.review_reason == "rule_conflict"
    assert txn.transaction_type == TransactionType.UNKNOWN


def test_real_data_food_and_books_keywords_classify_safely(session):
    from app.models.category import Category

    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    book = _make_txn(
        session, phonepe.id,
        amount=125.0,
        raw_narration="Paid to Vaseem Book and Stationery",
        raw_counterparty="Vaseem Book and Stationery",
        reference="R-BOOK-REAL-1",
    )
    soup = _make_txn(
        session, phonepe.id,
        amount=50.0,
        raw_narration="Paid to Soupy noodles 1",
        raw_counterparty="Soupy noodles 1",
        reference="R-SOUP-REAL-1",
    )
    apply_rules_to_transaction(session, book, rules)
    apply_rules_to_transaction(session, soup, rules)
    session.commit()

    book_category = session.get(Category, book.category_id)
    soup_category = session.get(Category, soup.category_id)
    assert book.transaction_type == TransactionType.EXPENSE
    assert book_category.name == "Books/Supplies"
    assert soup.transaction_type == TransactionType.EXPENSE
    assert soup_category.name == "Dining Out"


def test_specific_food_rule_beats_generic_hospital_rule(session):
    from app.models.category import Category

    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    canteen = _make_txn(
        session, phonepe.id,
        amount=70.0,
        raw_narration="Paid to PORT HOSPITAL CANTEEN",
        raw_counterparty="PORT HOSPITAL CANTEEN",
        reference="R-HOSP-CANTEEN-1",
    )
    hospitality = _make_txn(
        session, phonepe.id,
        amount=1850.0,
        raw_narration="Paid to BARBEQUE NATION HOSPITALITY LIMITED",
        raw_counterparty="BARBEQUE NATION HOSPITALITY LIMITED",
        reference="R-HOSPITALITY-1",
    )
    apply_rules_to_transaction(session, canteen, rules)
    apply_rules_to_transaction(session, hospitality, rules)
    session.commit()

    assert session.get(Category, canteen.category_id).name == "Dining Out"
    assert session.get(Category, hospitality.category_id).name == "Dining Out"
    assert canteen.needs_review is False
    assert hospitality.needs_review is False


def test_compatible_same_priority_rules_do_not_create_false_conflict(session):
    from app.models.category import Category

    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    txn = _make_txn(
        session, phonepe.id,
        amount=250.0,
        raw_narration="Paid to Example Cafe Restaurant",
        raw_counterparty="Example Cafe Restaurant",
        reference="R-COMPAT-1",
    )
    apply_rules_to_transaction(session, txn, get_active_rules(session))
    session.commit()

    assert txn.needs_review is False
    assert txn.transaction_type == TransactionType.EXPENSE
    assert session.get(Category, txn.category_id).name == "Dining Out"
    assert "compatible rules" in (txn.match_explanation or "").lower()


def test_stationers_and_bookmyshow_do_not_collide(session):
    """Whole-word book/stationer rules should catch real stationery shops
    without treating the concatenated BookMyShow brand as education."""
    from app.models.category import Category

    seed_all(session)
    phonepe = session.exec(select(Account).where(Account.account_type == AccountType.PHONEPE_WALLET)).first()
    rules = get_active_rules(session)

    stationers = _make_txn(
        session, phonepe.id,
        amount=90.0,
        raw_narration="Paid to K R Stationers",
        raw_counterparty="K R Stationers",
        reference="R-STATIONERS-REAL-1",
    )
    outing = _make_txn(
        session, phonepe.id,
        amount=450.0,
        raw_narration="Paid to Bookmyshow",
        raw_counterparty="Bookmyshow",
        reference="R-BOOKMYSHOW-1",
    )
    apply_rules_to_transaction(session, stationers, rules)
    apply_rules_to_transaction(session, outing, rules)
    session.commit()

    assert session.get(Category, stationers.category_id).name == "Books/Supplies"
    assert session.get(Category, outing.category_id).name == "Outings"
