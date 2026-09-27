"""Spec section 47: commitments can be satisfied by multiple
transactions/sources, partial payments must show PARTIAL, manual
(non-PhonePe) contributions must be supported, and rental income
allocated to a commitment must never be double-counted as spend/income."""
from __future__ import annotations

from datetime import date

from sqlmodel import select

from app.models.commitment import CommitmentPayment, RecurringCommitment
from app.services.calculations import calculate_cashflow, calculate_commitment_status, calculate_goal_progress
from app.services.seed import seed_all


def test_multiple_transactions_can_satisfy_one_commitment(session):
    seed_all(session)
    union_asha = session.exec(
        select(RecurringCommitment).where(RecurringCommitment.name == "Union/Asha Home Loan Arrangement")
    ).first()

    period = "2026-05"
    # ₹20,000 from rent + ₹15,000 + ₹5,000 via PhonePe = ₹40,000 total obligation completed.
    session.add(CommitmentPayment(commitment_id=union_asha.id, period=period, allocated_amount=20000, source_type="rent", is_manual=True))
    session.add(CommitmentPayment(commitment_id=union_asha.id, period=period, allocated_amount=15000, source_type="phonepe"))
    session.add(CommitmentPayment(commitment_id=union_asha.id, period=period, allocated_amount=5000, source_type="phonepe"))
    session.commit()

    status = calculate_commitment_status(session, union_asha.id, period)
    assert status["status"] == "completed"
    assert status["paid_amount"] == 40000.0
    assert len(status["payments"]) == 3
    sources = sorted(p["source_type"] for p in status["payments"])
    assert sources == ["phonepe", "phonepe", "rent"]


def test_partial_payment_shows_partial_status(session):
    seed_all(session)
    emi = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first()

    period = "2026-04"
    session.add(CommitmentPayment(commitment_id=emi.id, period=period, allocated_amount=10000, source_type="phonepe"))
    session.commit()

    status = calculate_commitment_status(session, emi.id, period)
    assert status["status"] == "partial"
    assert status["paid_amount"] == 10000.0


def test_pending_commitment_has_no_payments(session):
    seed_all(session)
    emi = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first()
    status = calculate_commitment_status(session, emi.id, "2099-01")
    assert status["status"] == "pending"
    assert status["paid_amount"] == 0


def test_overpaid_status_when_paid_exceeds_expected(session):
    seed_all(session)
    emi = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Home Loan EMI")).first()
    period = "2026-06"
    session.add(CommitmentPayment(commitment_id=emi.id, period=period, allocated_amount=19000, source_type="phonepe"))
    session.commit()
    status = calculate_commitment_status(session, emi.id, period)
    assert status["status"] == "overpaid"


def test_wifes_manual_sukanya_contribution_is_supported(session):
    """The wife's ₹1,000/month contribution is auto-deducted from HER
    OWN account and typically never appears in the user's PhonePe
    statement - it must still be recordable as a manual, confirmed
    contribution, never assumed to come from the user's own account."""
    seed_all(session)
    wife_commitment = session.exec(
        select(RecurringCommitment).where(RecurringCommitment.name == "Wife Sukanya contribution")
    ).first()
    assert wife_commitment.manual_contributions_allowed is True

    session.add(
        CommitmentPayment(
            commitment_id=wife_commitment.id,
            transaction_id=None,
            period="2026-06",
            allocated_amount=1000.0,
            source_type="manual",
            is_manual=True,
            manual_note="Confirmed with wife - deducted from her account on 5th.",
        )
    )
    session.commit()

    status = calculate_commitment_status(session, wife_commitment.id, "2026-06")
    assert status["status"] == "completed"
    assert status["payments"][0]["is_manual"] is True
    assert status["payments"][0]["transaction_id"] is None


def test_rental_allocation_does_not_double_count_as_income(session):
    """A manual CommitmentPayment sourced from rent is not a Transaction
    row, so it must never appear in cashflow income/expense totals -
    otherwise rent would be counted once as income and again as a loan
    payment, inflating both sides."""
    seed_all(session)
    union_asha = session.exec(
        select(RecurringCommitment).where(RecurringCommitment.name == "Union/Asha Home Loan Arrangement")
    ).first()
    session.add(
        CommitmentPayment(commitment_id=union_asha.id, period="2026-07", allocated_amount=20000, source_type="rent", is_manual=True)
    )
    session.commit()

    cashflow = calculate_cashflow(session, date(2026, 7, 1), date(2026, 8, 1))
    assert cashflow["money_in"] == 0
    assert cashflow["money_out"] == 0


def test_goal_progress_sums_commitment_payments_without_double_counting(session):
    seed_all(session)
    from app.models.goal import Goal

    goal = session.exec(select(Goal).where(Goal.name == "Sukanya Samriddhi")).first()
    my_sukanya = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "My Sukanya contribution")).first()
    wife_sukanya = session.exec(select(RecurringCommitment).where(RecurringCommitment.name == "Wife Sukanya contribution")).first()

    session.add(CommitmentPayment(commitment_id=my_sukanya.id, period="2026-01", allocated_amount=11500, source_type="phonepe"))
    session.add(CommitmentPayment(commitment_id=wife_sukanya.id, period="2026-01", allocated_amount=1000, source_type="manual", is_manual=True))
    session.commit()

    progress = calculate_goal_progress(session, goal.id)
    assert progress["total_contributed"] == 12500.0
