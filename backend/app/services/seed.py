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
from app.models.setting import Setting

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


def _seed_key(kind: str, name: str, parent_id: int | None = None) -> str:
    suffix = f":{parent_id}" if parent_id is not None else ""
    return f"seed:{kind}:{name}{suffix}"


def _seeded_by_id(session: Session, kind: str, name: str, model, parent_id: int | None = None):
    setting = session.get(Setting, _seed_key(kind, name, parent_id))
    if setting and setting.value:
        try:
            obj = session.get(model, int(setting.value))
            if obj is not None:
                return obj
        except ValueError:
            pass
    return None


def _remember_seed(session: Session, kind: str, name: str, obj, parent_id: int | None = None) -> None:
    key = _seed_key(kind, name, parent_id)
    setting = session.get(Setting, key)
    if setting is None:
        session.add(Setting(key=key, value=str(obj.id)))
    else:
        setting.value = str(obj.id)
        session.add(setting)



def _get_or_create_category(session: Session, name: str, parent_id: int | None = None) -> Category:
    existing = _seeded_by_id(session, "category", name, Category, parent_id)
    if existing is None:
        existing = session.exec(select(Category).where(Category.name == name, Category.parent_id == parent_id)).first()
    if existing:
        _remember_seed(session, "category", name, existing, parent_id)
        return existing
    cat = Category(name=name, parent_id=parent_id, is_system=True)
    session.add(cat); session.flush(); _remember_seed(session, "category", name, cat, parent_id)
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
        existing = _seeded_by_id(session, "label", name, Label)
        if existing is None:
            existing = session.exec(select(Label).where(Label.name == name)).first()
        if existing is None:
            existing = Label(name=name); session.add(existing); session.flush()
        _remember_seed(session, "label", name, existing)


def _get_or_create_account(session: Session, name: str, account_type: AccountType, **kwargs) -> Account:
    existing = _seeded_by_id(session, "account", name, Account)
    if existing is None:
        existing = session.exec(select(Account).where(Account.name == name)).first()
    if existing:
        _remember_seed(session, "account", name, existing); return existing
    acct = Account(name=name, account_type=account_type, **kwargs)
    session.add(acct); session.flush(); _remember_seed(session, "account", name, acct)
    return acct


def seed_accounts(session: Session) -> dict[str, Account]:
    phonepe = _get_or_create_account(session, "PhonePe", AccountType.PHONEPE_WALLET, institution="PhonePe", owner="self")
    cash = _get_or_create_account(session, "Cash", AccountType.CASH, owner="self")
    wife = _get_or_create_account(session, "Wife's Account", AccountType.WIFE_ACCOUNT, owner="wife")
    rental = _get_or_create_account(session, "Rental Income", AccountType.RENTAL, owner="self")
    return {"phonepe": phonepe, "cash": cash, "wife": wife, "rental": rental}


def _get_or_create_rule(session: Session, name: str, **kwargs) -> Rule:
    existing = _seeded_by_id(session, "rule", name, Rule)
    if existing is None:
        existing = session.exec(select(Rule).where(Rule.name == name)).first()
    if existing:
        _remember_seed(session, "rule", name, existing); return existing
    rule = Rule(name=name, **kwargs)
    session.add(rule); session.flush(); _remember_seed(session, "rule", name, rule)
    return rule


def _get_or_create_goal(session: Session, name: str, **kwargs) -> Goal:
    existing = _seeded_by_id(session, "goal", name, Goal)
    if existing is None:
        existing = session.exec(select(Goal).where(Goal.name == name)).first()
    if existing:
        _remember_seed(session, "goal", name, existing); return existing
    goal = Goal(name=name, **kwargs)
    session.add(goal); session.flush(); _remember_seed(session, "goal", name, goal)
    return goal


def _get_or_create_commitment(session: Session, name: str, **kwargs) -> RecurringCommitment:
    existing = _seeded_by_id(session, "commitment", name, RecurringCommitment)
    if existing is None:
        existing = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == name)).first()
    if existing:
        _remember_seed(session, "commitment", name, existing); return existing
    c = RecurringCommitment(name=name, **kwargs)
    session.add(c); session.flush(); _remember_seed(session, "commitment", name, c)
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
    _maybe_reapply_seed_rules(session)

    session.commit()


# --- Generic merchant/counterparty detection rules ----------------------
#
# These rules were expanded after profiling the user's real finance.db plus
# all supplied PhonePe CSV imports plus the 3,774-row finance database (3,761 unique imported PhonePe transaction IDs).  The
# rules intentionally target merchant-like words, not people's names or masked
# bank accounts. Ambiguous person-to-person payments stay in Review.
#
# Priority convention:
#   10  exact commitment/account rules
#   20  data-backed exceptions that must beat a broader generic rule
#   40  generic merchant/category rules
#   50+ review-only / catch-all rules
#
# The rule engine uses the lowest numeric matching priority. Multiple rules at
# the same priority are allowed when their actions are identical (e.g. a shop
# name containing both "soup" and "noodle" still cleanly becomes Dining Out).

MERCHANT_RULES_VERSION = "2026-09-28-counterparty-v3"

# (keyword, category, transaction_type, operator, priority)
MERCHANT_RULES: list[tuple[str, str, str, str, int]] = [
    # Real-data exceptions / strong identifiers.
    ("port hospital canteen", "Dining Out", "expense", "contains", 20),
    ("barbeque nation", "Dining Out", "expense", "contains", 20),
    ("indian railways catering and tourism", "Flights/Trains", "expense", "contains", 20),
    ("vasavi caterings", "Dining Out", "expense", "contains", 20),
    ("vasavi catterings", "Dining Out", "expense", "contains", 20),
    ("eastern power distribution company", "Utilities", "expense", "contains", 20),
    ("jio mobility", "Utilities", "expense", "contains", 20),

    # Food delivery.
    ("swiggy", "Food Delivery", "expense", "contains", 40),
    ("zomato", "Food Delivery", "expense", "contains", 40),
    ("eatsure", "Food Delivery", "expense", "contains", 40),
    ("faasos", "Food Delivery", "expense", "contains", 40),

    # Groceries / provisions.
    ("bigbasket", "Groceries", "expense", "contains", 40),
    ("bbnow", "Groceries", "expense", "contains", 40),
    ("blinkit", "Groceries", "expense", "contains", 40),
    ("zepto", "Groceries", "expense", "contains", 40),
    ("dunzo", "Groceries", "expense", "contains", 40),
    ("jiomart", "Groceries", "expense", "contains", 40),
    ("dmart", "Groceries", "expense", "contains", 40),
    ("avenue supermarts", "Groceries", "expense", "contains", 40),
    ("supermarket", "Groceries", "expense", "contains", 40),
    ("supermarts", "Groceries", "expense", "contains", 40),
    ("smart bazaar", "Groceries", "expense", "contains", 40),
    ("kirana", "Groceries", "expense", "word_contains", 40),
    ("fruits", "Groceries", "expense", "word_contains", 40),
    ("fruit stall", "Groceries", "expense", "contains", 40),
    ("vegetable", "Groceries", "expense", "word_contains", 40),
    ("vegetables", "Groceries", "expense", "word_contains", 40),
    ("spencers retail", "Groceries", "expense", "contains", 40),
    ("dairy", "Groceries", "expense", "word_contains", 40),
    ("milk", "Groceries", "expense", "word_contains", 40),
    ("chicken shop", "Groceries", "expense", "contains", 40),
    ("chicken centre", "Groceries", "expense", "contains", 40),
    ("chicken center", "Groceries", "expense", "contains", 40),
    ("general store", "Groceries", "expense", "contains", 50),
    ("general stores", "Groceries", "expense", "contains", 50),

    # Eating out. Kept separate from delivery so the calendar can answer
    # whether food was ordered or bought directly.
    ("soup", "Dining Out", "expense", "word_contains", 40),
    ("soups", "Dining Out", "expense", "word_contains", 40),
    ("tiffin", "Dining Out", "expense", "contains", 40),
    ("tiffen", "Dining Out", "expense", "contains", 40),
    ("noodle", "Dining Out", "expense", "contains", 40),
    ("noodel", "Dining Out", "expense", "contains", 40),
    ("hot food", "Dining Out", "expense", "contains", 40),
    ("curry point", "Dining Out", "expense", "contains", 40),
    ("restaurant", "Dining Out", "expense", "word_contains", 40),
    ("canteen", "Dining Out", "expense", "word_contains", 40),
    ("cafe", "Dining Out", "expense", "word_contains", 40),
    ("tea stall", "Dining Out", "expense", "contains", 40),
    ("tea shop", "Dining Out", "expense", "contains", 40),
    ("fast food", "Dining Out", "expense", "contains", 40),
    ("fastfood", "Dining Out", "expense", "contains", 40),
    ("food court", "Dining Out", "expense", "contains", 40),
    ("food plaza", "Dining Out", "expense", "contains", 40),
    ("egg roll", "Dining Out", "expense", "contains", 40),
    ("pizza", "Dining Out", "expense", "word_contains", 40),
    ("burger", "Dining Out", "expense", "word_contains", 40),
    ("biryani", "Dining Out", "expense", "word_contains", 40),
    ("bakery", "Dining Out", "expense", "word_contains", 40),
    ("baker", "Dining Out", "expense", "word_contains", 40),
    ("bakers", "Dining Out", "expense", "word_contains", 40),
    ("candy", "Dining Out", "expense", "word_contains", 40),
    ("momo", "Dining Out", "expense", "word_contains", 40),
    ("pani puri", "Dining Out", "expense", "contains", 40),
    ("hot chat", "Dining Out", "expense", "contains", 40),
    ("rolls", "Dining Out", "expense", "word_contains", 40),
    ("sweets", "Dining Out", "expense", "contains", 40),
    ("ice cream", "Dining Out", "expense", "contains", 40),
    ("juice", "Dining Out", "expense", "word_contains", 40),
    ("lassi", "Dining Out", "expense", "word_contains", 40),
    ("dhaba", "Dining Out", "expense", "word_contains", 40),
    ("dabha", "Dining Out", "expense", "word_contains", 40),
    ("fried chicken", "Dining Out", "expense", "contains", 40),
    ("chicken pakodi", "Dining Out", "expense", "contains", 40),
    ("non veg parcels", "Dining Out", "expense", "contains", 40),
    ("pastry", "Dining Out", "expense", "word_contains", 40),
    ("snacks", "Dining Out", "expense", "word_contains", 40),
    ("catering", "Dining Out", "expense", "word_contains", 40),
    ("caterings", "Dining Out", "expense", "word_contains", 40),
    ("catterings", "Dining Out", "expense", "word_contains", 40),
    ("kfc", "Dining Out", "expense", "word_contains", 40),
    ("dominos", "Dining Out", "expense", "contains", 40),
    ("mcdonald", "Dining Out", "expense", "contains", 40),
    ("mc donald", "Dining Out", "expense", "contains", 40),

    # Education / books. Whole-word book/books is safe for the observed data: it
    # matches real book shops but does not match concatenated names such as BookMyShow.
    ("stationery", "Books/Supplies", "expense", "contains", 40),
    ("stationary", "Books/Supplies", "expense", "word_contains", 40),
    ("stationer", "Books/Supplies", "expense", "word_contains", 40),
    ("stationers", "Books/Supplies", "expense", "word_contains", 40),
    ("book", "Books/Supplies", "expense", "word_contains", 40),
    ("books", "Books/Supplies", "expense", "word_contains", 40),
    ("book stall", "Books/Supplies", "expense", "contains", 40),
    ("book shop", "Books/Supplies", "expense", "contains", 40),
    ("book center", "Books/Supplies", "expense", "contains", 40),
    ("book centre", "Books/Supplies", "expense", "contains", 40),
    ("school", "Fees", "expense", "word_contains", 40),
    ("educational institutions", "Fees", "expense", "contains", 40),

    # E-commerce / shopping.
    ("amazon", "General Shopping", "expense", "contains", 40),
    ("flipkart", "General Shopping", "expense", "contains", 40),
    ("myntra", "General Shopping", "expense", "contains", 40),
    ("ajio", "General Shopping", "expense", "contains", 40),
    ("meesho", "General Shopping", "expense", "contains", 40),
    ("nykaa", "General Shopping", "expense", "contains", 40),
    ("digital age retail", "General Shopping", "expense", "contains", 40),
    ("lucky retail stores", "General Shopping", "expense", "contains", 40),
    ("decathlon", "General Shopping", "expense", "contains", 40),
    ("shoes", "Clothing", "expense", "word_contains", 40),
    ("shoe company", "Clothing", "expense", "contains", 40),
    ("fashion", "Clothing", "expense", "contains", 40),
    ("garments", "Clothing", "expense", "word_contains", 40),
    ("cloth shop", "Clothing", "expense", "contains", 40),
    ("bata india", "Clothing", "expense", "contains", 40),
    ("westside", "Clothing", "expense", "word_contains", 40),
    ("chandana brother", "Clothing", "expense", "contains", 40),
    ("electronics", "Electronics", "expense", "word_contains", 40),
    ("electricals", "Electronics", "expense", "word_contains", 40),
    ("cell point", "Electronics", "expense", "contains", 40),

    # Medical. Whole-word hospital avoids the old "hospitality" false
    # positive. Specific restaurant/canteen exceptions above win at priority 20.
    ("hospital", "Doctor/Hospital", "expense", "word_contains", 40),
    ("hospitals", "Doctor/Hospital", "expense", "word_contains", 40),
    ("clinic", "Doctor/Hospital", "expense", "word_contains", 40),
    ("nursing home", "Doctor/Hospital", "expense", "contains", 40),
    ("health care", "Doctor/Hospital", "expense", "contains", 40),
    ("healthcare", "Doctor/Hospital", "expense", "contains", 40),
    ("medical centre", "Doctor/Hospital", "expense", "contains", 40),
    ("medical center", "Doctor/Hospital", "expense", "contains", 40),
    ("diagnostic", "Doctor/Hospital", "expense", "contains", 40),
    ("ivf", "Doctor/Hospital", "expense", "word_contains", 40),
    ("fortis", "Doctor/Hospital", "expense", "contains", 40),
    ("max healthcare", "Doctor/Hospital", "expense", "contains", 40),
    ("pathlab", "Doctor/Hospital", "expense", "contains", 40),
    ("pharmacy", "Pharmacy", "expense", "word_contains", 40),
    ("pharmacies", "Pharmacy", "expense", "word_contains", 40),
    ("medicals", "Pharmacy", "expense", "word_contains", 40),
    ("medical store", "Pharmacy", "expense", "contains", 40),
    ("medical stores", "Pharmacy", "expense", "contains", 40),
    ("medical and general", "Pharmacy", "expense", "contains", 40),
    ("chemist", "Pharmacy", "expense", "contains", 40),
    ("pharmacist", "Pharmacy", "expense", "word_contains", 40),
    ("pharmeasy", "Pharmacy", "expense", "contains", 40),
    ("netmeds", "Pharmacy", "expense", "contains", 40),
    ("1mg", "Pharmacy", "expense", "contains", 40),
    ("medplus", "Pharmacy", "expense", "contains", 40),
    ("apollo pharmacy", "Pharmacy", "expense", "contains", 40),

    # Insurance.
    ("policybazaar", "Insurance", "expense", "contains", 40),
    ("licindia", "Insurance", "expense", "contains", 40),
    ("lic of india", "Insurance", "expense", "contains", 40),
    ("star health", "Insurance", "expense", "contains", 40),
    ("hdfc life", "Insurance", "expense", "contains", 40),
    ("icici prudential", "Insurance", "expense", "contains", 40),

    # Entertainment / outings.
    ("netflix", "Subscriptions", "expense", "contains", 40),
    ("hotstar", "Subscriptions", "expense", "contains", 40),
    ("spotify", "Subscriptions", "expense", "contains", 40),
    ("sonyliv", "Subscriptions", "expense", "contains", 40),
    ("zee5", "Subscriptions", "expense", "contains", 40),
    ("youtube premium", "Subscriptions", "expense", "contains", 40),
    ("bookmyshow", "Outings", "expense", "contains", 40),
    ("pvr", "Outings", "expense", "contains", 40),
    ("inox", "Outings", "expense", "contains", 40),
    ("amusement", "Outings", "expense", "contains", 40),
    ("playmore", "Outings", "expense", "contains", 40),

    # Transport and vehicle upkeep.
    ("indian oil", "Fuel", "expense", "contains", 40),
    ("iocl", "Fuel", "expense", "contains", 40),
    ("hpcl", "Fuel", "expense", "contains", 40),
    ("bpcl", "Fuel", "expense", "contains", 40),
    ("bharat petroleum", "Fuel", "expense", "contains", 40),
    ("petrol pump", "Fuel", "expense", "contains", 40),
    ("petroleum", "Fuel", "expense", "word_contains", 40),
    ("fuels", "Fuel", "expense", "word_contains", 40),
    ("fuel fil", "Fuel", "expense", "contains", 40),
    ("filling station", "Fuel", "expense", "contains", 40),
    ("uber", "Cab/Auto", "expense", "contains", 40),
    ("ola cabs", "Cab/Auto", "expense", "contains", 40),
    ("rapido", "Cab/Auto", "expense", "contains", 40),
    ("bike wash", "Vehicle Maintenance", "expense", "contains", 40),
    ("automobile", "Vehicle Maintenance", "expense", "contains", 40),
    ("automobiles", "Vehicle Maintenance", "expense", "contains", 40),
    ("tyres", "Vehicle Maintenance", "expense", "word_contains", 40),
    ("battery zone", "Vehicle Maintenance", "expense", "contains", 40),

    # Home / utilities / maintenance.
    ("airtel", "Utilities", "expense", "contains", 40),
    ("jio recharge", "Utilities", "expense", "contains", 40),
    ("myjio", "Utilities", "expense", "contains", 40),
    ("reliance jio", "Utilities", "expense", "contains", 40),
    ("recharge", "Utilities", "expense", "word_contains", 40),
    ("recharges", "Utilities", "expense", "word_contains", 40),
    ("vodafone", "Utilities", "expense", "contains", 40),
    ("bsnl", "Utilities", "expense", "contains", 40),
    ("broadband", "Utilities", "expense", "word_contains", 40),
    ("electricity", "Utilities", "expense", "word_contains", 40),
    ("power distribution", "Utilities", "expense", "contains", 40),
    ("apepdcl", "Utilities", "expense", "contains", 40),
    ("tatasky", "Utilities", "expense", "contains", 40),
    ("tata sky", "Utilities", "expense", "contains", 40),
    ("dishtv", "Utilities", "expense", "contains", 40),
    ("dish tv", "Utilities", "expense", "contains", 40),
    ("bharat gas", "Utilities", "expense", "contains", 40),
    ("indane", "Utilities", "expense", "contains", 40),
    ("lpg", "Utilities", "expense", "word_contains", 40),
    ("billdesk", "Utilities", "expense", "contains", 40),
    ("bbps", "Utilities", "expense", "contains", 40),
    ("freecharge", "Utilities", "expense", "contains", 40),
    ("hardware", "Maintenance", "expense", "word_contains", 40),

    # Travel.
    ("irctc", "Flights/Trains", "expense", "contains", 40),
    ("indian railways", "Flights/Trains", "expense", "contains", 40),
    ("indigo", "Flights/Trains", "expense", "contains", 40),
    ("spicejet", "Flights/Trains", "expense", "contains", 40),
    ("air india", "Flights/Trains", "expense", "contains", 40),
    ("vistara", "Flights/Trains", "expense", "contains", 40),
    ("akasa air", "Flights/Trains", "expense", "contains", 40),
    ("oyo", "Hotels", "expense", "contains", 40),
    ("resort", "Hotels", "expense", "word_contains", 40),
    ("resorts", "Hotels", "expense", "word_contains", 40),
    ("lodge", "Hotels", "expense", "word_contains", 40),
    ("makemytrip", "Trip Expenses", "expense", "contains", 40),
    ("goibibo", "Trip Expenses", "expense", "contains", 40),
    ("yatra", "Trip Expenses", "expense", "contains", 40),
    ("redbus", "Trip Expenses", "expense", "contains", 40),
]

# Credits received back from a known merchant are safe to treat as refunds.
# This is deliberately much smaller than the debit list.
MERCHANT_REFUND_RULES: list[tuple[str, str, str]] = [
    ("flipkart", "General Shopping", "contains"),
    ("amazon", "General Shopping", "contains"),
    ("swiggy", "Food Delivery", "contains"),
    ("zomato", "Food Delivery", "contains"),
    ("irctc", "Flights/Trains", "contains"),
    ("indian railways", "Flights/Trains", "contains"),
    ("airtel", "Utilities", "contains"),
    ("recharge", "Utilities", "word_contains"),
    ("bookmyshow", "Outings", "contains"),
]


def _generic_conditions(keyword: str, operator: str, direction: str) -> list[dict]:
    return [
        {"field": ConditionField.COUNTERPARTY.value, "operator": operator, "value": keyword},
        {"field": ConditionField.DIRECTION.value, "operator": ConditionOperator.EQUALS.value, "value": direction},
    ]


def _seed_generic_rule(
    session: Session,
    *,
    name: str,
    description: str,
    keyword: str,
    operator: str,
    direction: str,
    category: Category,
    txn_type: str,
    priority: int,
) -> Rule:
    actions = [
        {"type": RuleActionType.SET_CATEGORY.value, "value": category.id},
        {"type": RuleActionType.SET_TRANSACTION_TYPE.value, "value": txn_type},
    ]
    new_conditions = _generic_conditions(keyword, operator, direction)
    rule = _get_or_create_rule(
        session,
        name,
        description=description,
        priority=priority,
        conditions=new_conditions,
        actions=actions,
    )

    # Existing installations may already have the old generated rule. Update
    # only an untouched legacy generated definition; never overwrite a rule the
    # user actually edited.
    legacy_conditions = _generic_conditions(keyword, ConditionOperator.CONTAINS.value, direction)
    generic_descriptions = (
        "Generic starter rule (not evidence-based)",
        "Data-informed merchant rule",
        "Recognized merchant credit",
    )
    looks_generated = not rule.description or any(rule.description.startswith(prefix) for prefix in generic_descriptions)
    if looks_generated and rule.actions == actions and rule.conditions in (legacy_conditions, new_conditions):
        rule.conditions = new_conditions
        rule.actions = actions
        rule.priority = priority
        rule.description = description
        rule.is_active = True
        session.add(rule)
    return rule


def seed_merchant_rules(session: Session, categories: dict[str, Category]) -> None:
    for keyword, category_name, txn_type, operator, priority in MERCHANT_RULES:
        category = categories.get(category_name)
        if not category:
            continue
        _seed_generic_rule(
            session,
            name=f"Merchant: {keyword.title()} -> {category_name}",
            description=(
                f"Data-informed merchant rule: debit counterparty {operator.replace('_', ' ')} "
                f"'{keyword}'. Built from the supplied finance database/imports; editable from Rules."
            ),
            keyword=keyword,
            operator=operator,
            direction="debit",
            category=category,
            txn_type=txn_type,
            priority=priority,
        )

    for keyword, category_name, operator in MERCHANT_REFUND_RULES:
        category = categories.get(category_name)
        if not category:
            continue
        _seed_generic_rule(
            session,
            name=f"Refund: {keyword.title()} -> {category_name}",
            description=f"Recognized merchant credit from '{keyword}' -> refund; keeps returned money separate from income.",
            keyword=keyword,
            operator=operator,
            direction="credit",
            category=category,
            txn_type="refund",
            priority=40,
        )


def _maybe_reapply_seed_rules(session: Session) -> None:
    """One-time reclassification when the built-in merchant rules change.

    Manual classifications are authoritative and are skipped by the rule
    engine. Imported/unclassified and rule-managed rows are re-evaluated so an
    existing database benefits from newly-added patterns without requiring the
    user to remember to press "Re-apply rules" after an upgrade.
    """
    version_key = "seed:merchant_rules_version"
    current = session.get(Setting, version_key)
    if current and current.value == MERCHANT_RULES_VERSION:
        return

    from app.models.transaction import Transaction
    from app.rules.engine import apply_rules_to_transaction, get_active_rules

    session.flush()
    rules = get_active_rules(session)
    txns = session.exec(
        select(Transaction).where(
            Transaction.is_ignored == False,  # noqa: E712
            Transaction.classification_source != "manual",
        )
    ).all()
    for txn in txns:
        apply_rules_to_transaction(session, txn, rules)
        session.add(txn)

    if current is None:
        session.add(Setting(key=version_key, value=MERCHANT_RULES_VERSION))
    else:
        current.value = MERCHANT_RULES_VERSION
        session.add(current)
