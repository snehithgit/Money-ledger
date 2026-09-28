"""
Initial seed configuration (spec section 42).

Everything here is either:
  (a) a generic default any household finance app needs (category
      tree, labels, a PhonePe account), or
  (b) one of the five commitments the user explicitly specified, with
      amounts taken verbatim from their brief - never invented, or
  (c) a small set of auto-matching rules built ONLY from patterns
      confirmed by inspecting the user's real PhonePe statements
      (see backend/docs/rule_evidence.md for the exact evidence: which
      masked bank account received which exact amount, how many times,
      and over what date range). No recipient identifier or due date
      is fabricated - where the real data didn't show a clean,
      repeated, exact-amount match, the commitment is seeded with NO
      matching rule at all and simply starts at status=PENDING/needs
      manual attachment, per the spec's explicit instruction not to
      guess.

Seeding is idempotent: running it twice does not create duplicates,
so it's safe to call on every app startup.
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models.account import Account
from app.models.category import Category
from app.models.commitment import RecurringCommitment
from app.models.enums import AccountType, ConditionField, ConditionOperator, Frequency, RelationshipType, RuleActionType
from app.models.goal import Goal
from app.models.label import Label
from app.models.rule import Rule

DEFAULT_CATEGORIES: list[tuple[str, list[str]]] = [
    ("Income", ["Salary", "Rental Income", "Other Income"]),
    ("Home", ["Rent", "Utilities", "Maintenance", "Home Loan"]),
    ("Food", ["Groceries", "Dining Out", "Food Delivery"]),
    ("Transport", ["Fuel", "Public Transport", "Cab/Auto", "Vehicle Maintenance"]),
    ("Shopping", ["Clothing", "Electronics", "General Shopping"]),
    ("Family", ["Family Support", "Gifts"]),
    ("Education", ["Fees", "Books/Supplies"]),
    ("Medical", ["Doctor/Hospital", "Pharmacy", "Insurance"]),
    ("Entertainment", ["Subscriptions", "Outings"]),
    ("Travel", ["Flights/Trains", "Hotels", "Trip Expenses"]),
    ("Loans", ["Home Loan EMI", "Home Loan Top-Up EMI", "Other Loan"]),
    ("Savings", ["Sukanya Samriddhi", "Fixed Deposit", "Mutual Funds/Stocks"]),
    ("Transfers", ["Own Account Transfer", "Cash Withdrawal", "Cash Deposit"]),
    ("Cash", ["Cash Spend"]),
    ("Uncategorized", []),
]

DEFAULT_LABELS = ["EMI", "Daughter", "Sukanya", "HomeLoan", "Rental", "Family", "Recurring", "Medical", "Work", "Cash"]


def _get_or_create_category(session: Session, name: str, parent_id: int | None = None) -> Category:
    existing = session.exec(select(Category).where(Category.name == name, Category.parent_id == parent_id)).first()
    if existing:
        return existing
    cat = Category(name=name, parent_id=parent_id, is_system=True)
    session.add(cat)
    session.flush()
    return cat


def seed_categories(session: Session) -> dict[str, Category]:
    by_name: dict[str, Category] = {}
    for parent_name, children in DEFAULT_CATEGORIES:
        parent = _get_or_create_category(session, parent_name)
        by_name[parent_name] = parent
        for child_name in children:
            child = _get_or_create_category(session, child_name, parent_id=parent.id)
            by_name[child_name] = child
    return by_name


def seed_labels(session: Session) -> None:
    for name in DEFAULT_LABELS:
        existing = session.exec(select(Label).where(Label.name == name)).first()
        if not existing:
            session.add(Label(name=name))


def _get_or_create_account(session: Session, name: str, account_type: AccountType, **kwargs) -> Account:
    existing = session.exec(select(Account).where(Account.name == name)).first()
    if existing:
        return existing
    acct = Account(name=name, account_type=account_type, **kwargs)
    session.add(acct)
    session.flush()
    return acct


def seed_accounts(session: Session) -> dict[str, Account]:
    phonepe = _get_or_create_account(session, "PhonePe", AccountType.PHONEPE_WALLET, institution="PhonePe", owner="self")
    cash = _get_or_create_account(session, "Cash", AccountType.CASH, owner="self")
    wife = _get_or_create_account(session, "Wife's Account", AccountType.WIFE_ACCOUNT, owner="wife")
    rental = _get_or_create_account(session, "Rental Income", AccountType.RENTAL, owner="self")
    return {"phonepe": phonepe, "cash": cash, "wife": wife, "rental": rental}


def _get_or_create_rule(session: Session, name: str, **kwargs) -> Rule:
    existing = session.exec(select(Rule).where(Rule.name == name)).first()
    if existing:
        return existing
    rule = Rule(name=name, **kwargs)
    session.add(rule)
    session.flush()
    return rule


def _get_or_create_goal(session: Session, name: str, **kwargs) -> Goal:
    existing = session.exec(select(Goal).where(Goal.name == name)).first()
    if existing:
        return existing
    goal = Goal(name=name, **kwargs)
    session.add(goal)
    session.flush()
    return goal


def _get_or_create_commitment(session: Session, name: str, **kwargs) -> RecurringCommitment:
    existing = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == name)).first()
    if existing:
        return existing
    c = RecurringCommitment(name=name, **kwargs)
    session.add(c)
    session.flush()
    return c


def seed_all(session: Session) -> None:
    categories = seed_categories(session)
    seed_labels(session)
    accounts = seed_accounts(session)

    sukanya_goal = _get_or_create_goal(
        session,
        "Sukanya Samriddhi",
        category_id=categories["Sukanya Samriddhi"].id,
        notes="Daughter's Sukanya Samriddhi Yojana savings account.",
    )

    my_sukanya = _get_or_create_commitment(
        session,
        "My Sukanya contribution",
        group_name="Sukanya Samriddhi",
        expected_amount=11500.0,
        frequency=Frequency.MONTHLY,
        category_id=categories["Sukanya Samriddhi"].id,
        payment_account_id=accounts["phonepe"].id,
        goal_id=sukanya_goal.id,
        allow_partial_payment=True,
        allow_multiple_transactions=True,
        manual_contributions_allowed=False,
        notes="Own contribution, paid via PhonePe. ₹11,500/month = ₹138,000/year.",
    )

    _get_or_create_commitment(
        session,
        "Wife Sukanya contribution",
        group_name="Sukanya Samriddhi",
        expected_amount=1000.0,
        frequency=Frequency.MONTHLY,
        category_id=categories["Sukanya Samriddhi"].id,
        payment_account_id=accounts["wife"].id,
        goal_id=sukanya_goal.id,
        allow_partial_payment=True,
        allow_multiple_transactions=False,
        manual_contributions_allowed=True,
        auto_confirm=True,
        notes="Auto-deducted from wife's own account - never visible in the PhonePe "
        "statement, but happens reliably every month, so it's auto-confirmed as paid "
        "each period without needing a manual click. 'Add manual contribution' is still "
        "there if you ever need to record a different amount for a specific month.",
    )

    emi = _get_or_create_commitment(
        session,
        "Home Loan EMI",
        group_name="Home / Property Finance",
        expected_amount=18000.0,
        frequency=Frequency.MONTHLY,
        category_id=categories["Home Loan EMI"].id,
        payment_account_id=accounts["phonepe"].id,
        allow_partial_payment=True,
        allow_multiple_transactions=False,
        notes="Main home loan EMI. Tracked independently - never combined with the Top-Up EMI.",
    )

    topup = _get_or_create_commitment(
        session,
        "Home Loan Top-Up EMI",
        group_name="Home / Property Finance",
        expected_amount=21000.0,
        frequency=Frequency.MONTHLY,
        category_id=categories["Home Loan Top-Up EMI"].id,
        payment_account_id=accounts["phonepe"].id,
        allow_partial_payment=True,
        allow_multiple_transactions=False,
        notes="Separate Top-Up EMI. Never combined with the main ₹18,000 EMI even though "
        "both belong to Home / Property Finance.",
    )

    union_asha = _get_or_create_commitment(
        session,
        "Union/Asha Home Loan Arrangement",
        group_name="Home / Property Finance",
        expected_amount=40000.0,
        frequency=Frequency.MONTHLY,
        category_id=categories["Home Loan"].id,
        allow_partial_payment=True,
        allow_multiple_transactions=True,
        manual_contributions_allowed=True,
        notes="₹40,000 total obligation. Typically ~₹20,000 funded directly from rental "
        "income (log as a manual contribution, source_type='rent'), with the remainder "
        "paid via PhonePe and/or other manual sources. No recipient identifier or due "
        "date is hard-coded - attach payments from the Commitments page as they're "
        "identified in your real statement.",
    )

    # --- Evidence-based auto-matching rules -----------------------------
    # Each rule below is backed by an exact, repeated pattern found in the
    # user's real PhonePe statements (counterparty + exact amount,
    # recurring across multiple months) - see backend/docs/rule_evidence.md.
    _get_or_create_rule(
        session,
        "Sukanya contribution -> Bank Account XXXXXXX3810 (₹11,500)",
        description="22 occurrences, May 2023-Jul 2025, always exactly ₹11,500.",
        priority=10,
        conditions=[
            {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.CONTAINS.value, "value": "3810"},
            {"field": ConditionField.AMOUNT.value, "operator": ConditionOperator.EQUALS.value, "value": 11500.0},
            {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": "debit"},
        ],
        actions=[
            {"type": RuleActionType.SET_CATEGORY.value, "value": categories["Sukanya Samriddhi"].id},
            {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": "savings"},
            {"type": RuleActionType.ATTACH_COMMITMENT.value, "value": my_sukanya.id},
        ],
    )

    _get_or_create_rule(
        session,
        "Home Loan EMI -> Bank Account XXXXXXX6735 (₹18,000)",
        description="7 occurrences, Feb-Sep 2026, always exactly ₹18,000.",
        priority=10,
        conditions=[
            {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.CONTAINS.value, "value": "6735"},
            {"field": ConditionField.AMOUNT.value, "operator": ConditionOperator.EQUALS.value, "value": 18000.0},
            {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": "debit"},
        ],
        actions=[
            {"type": RuleActionType.SET_CATEGORY.value, "value": categories["Home Loan EMI"].id},
            {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": "emi"},
            {"type": RuleActionType.ATTACH_COMMITMENT.value, "value": emi.id},
        ],
    )

    _get_or_create_rule(
        session,
        "Home Loan Top-Up EMI -> Bank Account XXXXXXX4488 (₹21,000)",
        description="3 occurrences, Feb-Apr 2026, always exactly ₹21,000.",
        priority=10,
        conditions=[
            {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.CONTAINS.value, "value": "4488"},
            {"field": ConditionField.AMOUNT.value, "operator": ConditionOperator.EQUALS.value, "value": 21000.0},
            {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": "debit"},
        ],
        actions=[
            {"type": RuleActionType.SET_CATEGORY.value, "value": categories["Home Loan Top-Up EMI"].id},
            {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": "emi"},
            {"type": RuleActionType.ATTACH_COMMITMENT.value, "value": topup.id},
        ],
    )

    _get_or_create_rule(
        session,
        "Union/Asha arrangement -> Bank Account XXXXXXXXXXX0987 (₹40,000)",
        description="9 occurrences, Jan-Sep 2026, always exactly ₹40,000 - a month paid in full via PhonePe.",
        priority=10,
        conditions=[
            {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.CONTAINS.value, "value": "0987"},
            {"field": ConditionField.AMOUNT.value, "operator": ConditionOperator.EQUALS.value, "value": 40000.0},
            {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": "debit"},
        ],
        actions=[
            {"type": RuleActionType.SET_CATEGORY.value, "value": categories["Home Loan"].id},
            {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": "loan_payment"},
            {"type": RuleActionType.ATTACH_COMMITMENT.value, "value": union_asha.id},
        ],
    )

    # "ASHA" transactions vary from ₹1 to ₹1,00,000+ in both directions -
    # too inconsistent to auto-attach to a fixed-amount commitment, but
    # far too frequent to leave completely uncategorized. Tag + flag for
    # manual review rather than guess.
    _get_or_create_rule(
        session,
        "ASHA payment (needs review - variable amount)",
        description="Counterparty 'ASHA' appears very frequently with widely varying amounts in "
        "both directions - likely related to the Union/Asha home loan arrangement or family "
        "settlement, but amounts are too inconsistent to auto-attach safely.",
        priority=50,
        conditions=[
            {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.EQUALS.value, "value": "asha"},
        ],
        actions=[
            {"type": RuleActionType.SET_CATEGORY.value, "value": categories["Home Loan"].id},
            {"type": RuleActionType.NEEDS_REVIEW.value, "value": None},
        ],
    )

    seed_merchant_rules(session, categories)

    session.commit()


# --- Generic merchant/counterparty detection rules ----------------------
#
# Unlike the evidence-based rules above (tied to THIS user's specific
# masked account numbers, each backed by real repeated evidence - see
# backend/docs/rule_evidence.md), these are generic starter rules built
# from well-known Indian UPI/PhonePe merchant naming conventions
# (Swiggy, Amazon, hospital chains, mobile recharge/bill aggregators,
# etc.). They exist so common, everyday spending gets auto-categorized
# out of the box instead of piling up in Review for merchants that
# aren't tied to a personal commitment.
#
# They are ordinary rules like any other - fully visible, editable,
# and deletable from the Rules page. If your statement spells a
# merchant differently (or a keyword below is too broad/narrow for
# your data), just edit or delete that one rule; nothing here is
# hard-coded elsewhere. Matches are case-insensitive "contains" against
# `counterparty`, restricted to debits only so a refund/credit from the
# same merchant doesn't get silently marked as an expense.
#
# (keyword, category name, transaction_type)
MERCHANT_RULES: list[tuple[str, str, str]] = [
    # Food delivery -> Food / Food Delivery
    ("swiggy", "Food Delivery", "expense"),
    ("zomato", "Food Delivery", "expense"),
    ("eatsure", "Food Delivery", "expense"),
    ("faasos", "Food Delivery", "expense"),
    # Online groceries -> Food / Groceries
    ("bigbasket", "Groceries", "expense"),
    ("blinkit", "Groceries", "expense"),
    ("zepto", "Groceries", "expense"),
    ("dunzo", "Groceries", "expense"),
    ("jiomart", "Groceries", "expense"),
    ("dmart", "Groceries", "expense"),
    # E-commerce -> Shopping / General Shopping
    ("amazon", "General Shopping", "expense"),
    ("flipkart", "General Shopping", "expense"),
    ("myntra", "General Shopping", "expense"),
    ("ajio", "General Shopping", "expense"),
    ("meesho", "General Shopping", "expense"),
    ("nykaa", "General Shopping", "expense"),
    # Hospitals/clinics/diagnostics -> Medical / Doctor/Hospital
    ("hospital", "Doctor/Hospital", "expense"),
    ("clinic", "Doctor/Hospital", "expense"),
    ("diagnostic", "Doctor/Hospital", "expense"),
    ("fortis", "Doctor/Hospital", "expense"),
    ("max healthcare", "Doctor/Hospital", "expense"),
    ("pathlab", "Doctor/Hospital", "expense"),
    # Pharmacies -> Medical / Pharmacy
    ("pharmeasy", "Pharmacy", "expense"),
    ("netmeds", "Pharmacy", "expense"),
    ("1mg", "Pharmacy", "expense"),
    ("medplus", "Pharmacy", "expense"),
    ("apollo pharmacy", "Pharmacy", "expense"),
    # Insurance -> Medical / Insurance
    ("policybazaar", "Insurance", "expense"),
    ("licindia", "Insurance", "expense"),
    ("lic of india", "Insurance", "expense"),
    ("star health", "Insurance", "expense"),
    ("hdfc life", "Insurance", "expense"),
    ("icici prudential", "Insurance", "expense"),
    # Streaming/subscriptions -> Entertainment / Subscriptions
    ("netflix", "Subscriptions", "expense"),
    ("hotstar", "Subscriptions", "expense"),
    ("spotify", "Subscriptions", "expense"),
    ("sonyliv", "Subscriptions", "expense"),
    ("zee5", "Subscriptions", "expense"),
    ("youtube premium", "Subscriptions", "expense"),
    # Movies/outings -> Entertainment / Outings
    ("bookmyshow", "Outings", "expense"),
    ("pvr", "Outings", "expense"),
    ("inox", "Outings", "expense"),
    # Fuel -> Transport / Fuel
    ("indian oil", "Fuel", "expense"),
    ("iocl", "Fuel", "expense"),
    ("hpcl", "Fuel", "expense"),
    ("bpcl", "Fuel", "expense"),
    ("bharat petroleum", "Fuel", "expense"),
    # Cabs -> Transport / Cab/Auto
    ("uber", "Cab/Auto", "expense"),
    ("ola cabs", "Cab/Auto", "expense"),
    ("rapido", "Cab/Auto", "expense"),
    # Recharge / bill payments -> Home / Utilities
    ("airtel", "Utilities", "expense"),
    ("jio recharge", "Utilities", "expense"),
    ("myjio", "Utilities", "expense"),
    ("reliance jio", "Utilities", "expense"),
    ("vodafone", "Utilities", "expense"),
    ("bsnl", "Utilities", "expense"),
    ("tatasky", "Utilities", "expense"),
    ("tata sky", "Utilities", "expense"),
    ("dishtv", "Utilities", "expense"),
    ("dish tv", "Utilities", "expense"),
    ("bharat gas", "Utilities", "expense"),
    ("indane", "Utilities", "expense"),
    ("billdesk", "Utilities", "expense"),  # a real UPI bill-payment gateway used for many billers
    ("bbps", "Utilities", "expense"),  # Bharat Bill Payment System - same idea
    ("freecharge", "Utilities", "expense"),
    # Travel -> Travel / Flights/Trains, Hotels, Trip Expenses
    ("irctc", "Flights/Trains", "expense"),
    ("indigo", "Flights/Trains", "expense"),
    ("spicejet", "Flights/Trains", "expense"),
    ("air india", "Flights/Trains", "expense"),
    ("vistara", "Flights/Trains", "expense"),
    ("akasa air", "Flights/Trains", "expense"),
    ("oyo", "Hotels", "expense"),
    ("makemytrip", "Trip Expenses", "expense"),
    ("goibibo", "Trip Expenses", "expense"),
    ("yatra", "Trip Expenses", "expense"),
    ("redbus", "Trip Expenses", "expense"),
]


def seed_merchant_rules(session: Session, categories: dict[str, Category]) -> None:
    for keyword, category_name, txn_type in MERCHANT_RULES:
        category = categories.get(category_name)
        if not category:
            continue
        _get_or_create_rule(
            session,
            f"Merchant: {keyword.title()} -> {category_name}",
            description=f"Generic starter rule (not evidence-based) - counterparty contains "
            f"'{keyword}'. Edit or delete this if your statement spells it differently.",
            priority=40,
            conditions=[
                {"field": ConditionField.COUNTERPARTY.value, "operator": ConditionOperator.CONTAINS.value, "value": keyword},
                {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": "debit"},
            ],
            actions=[
                {"type": RuleActionType.SET_CATEGORY.value, "value": category.id},
                {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": txn_type},
            ],
        )
