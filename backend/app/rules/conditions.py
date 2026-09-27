from __future__ import annotations

from app.models.transaction import Transaction


def _s(v) -> str:
    return str(v).strip().lower()


def evaluate_condition(txn: Transaction, condition: dict) -> bool:
    field = condition["field"]
    op = condition["operator"]
    value = condition["value"]

    if field == "counterparty":
        target = _s(txn.raw_counterparty)
    elif field == "narration":
        target = _s(txn.raw_narration)
    elif field == "upi_id":
        target = _s(txn.upi_id or "")
    elif field == "reference":
        target = _s(txn.reference or "")
    elif field == "bank":
        target = _s(txn.raw_instrument or "")
    elif field == "direction":
        return _s(txn.direction.value if hasattr(txn.direction, "value") else txn.direction) == _s(value)
    elif field == "transaction_type":
        current = txn.transaction_type.value if hasattr(txn.transaction_type, "value") else txn.transaction_type
        return _s(current) == _s(value)
    elif field == "account":
        return txn.account_id == int(value)
    elif field == "amount":
        return _eval_numeric(txn.amount, op, value)
    elif field == "day_of_month":
        return _eval_numeric(txn.date.day, op, value)
    else:
        return False

    if op == "equals":
        return target == _s(value)
    if op == "contains":
        return _s(value) in target
    return False


def _eval_numeric(actual: float, op: str, value) -> bool:
    if op == "equals":
        return abs(actual - float(value)) < 0.005
    if op == "range":
        lo, hi = float(value[0]), float(value[1])
        return lo <= actual <= hi
    if op == "greater_than":
        return actual > float(value)
    if op == "less_than":
        return actual < float(value)
    return False


def matches_all(txn: Transaction, conditions: list[dict]) -> bool:
    return all(evaluate_condition(txn, c) for c in conditions)


def explain_match(conditions: list[dict]) -> str:
    parts = []
    for c in conditions:
        field, op, value = c["field"], c["operator"], c["value"]
        if op == "contains":
            parts.append(f"{field} contains '{value}'")
        elif op == "equals":
            parts.append(f"{field} equals '{value}'")
        elif op == "range":
            parts.append(f"{field} between {value[0]} and {value[1]}")
        elif op == "greater_than":
            parts.append(f"{field} > {value}")
        elif op == "less_than":
            parts.append(f"{field} < {value}")
    return " AND ".join(parts)
