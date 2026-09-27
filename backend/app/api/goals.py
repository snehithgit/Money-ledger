from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.goal import Goal, GoalContribution
from app.schemas.schemas import GoalContributionCreate, GoalCreate, GoalUpdate
from app.services.calculations import calculate_goal_progress

router = APIRouter(prefix="/api/goals", tags=["goals"])


@router.get("")
def list_goals(session: Session = Depends(get_session)):
    goals = session.exec(select(Goal)).all()
    return [calculate_goal_progress(session, g.id) for g in goals]


@router.post("")
def create_goal(payload: GoalCreate, session: Session = Depends(get_session)):
    g = Goal(**payload.model_dump())
    session.add(g)
    session.commit()
    session.refresh(g)
    return g


@router.get("/{goal_id}")
def get_goal(goal_id: int, session: Session = Depends(get_session)):
    g = session.get(Goal, goal_id)
    if not g:
        raise HTTPException(404, "goal not found")
    return calculate_goal_progress(session, goal_id)


@router.patch("/{goal_id}")
def update_goal(goal_id: int, payload: GoalUpdate, session: Session = Depends(get_session)):
    g = session.get(Goal, goal_id)
    if not g:
        raise HTTPException(404, "goal not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(g, k, v)
    session.add(g)
    session.commit()
    session.refresh(g)
    return g


@router.post("/{goal_id}/contributions")
def add_contribution(goal_id: int, payload: GoalContributionCreate, session: Session = Depends(get_session)):
    g = session.get(Goal, goal_id)
    if not g:
        raise HTTPException(404, "goal not found")
    contribution = GoalContribution(
        goal_id=goal_id,
        amount=payload.amount,
        date=payload.date,
        transaction_id=payload.transaction_id,
        is_manual=payload.transaction_id is None,
        manual_note=payload.manual_note,
    )
    session.add(contribution)
    session.commit()
    session.refresh(contribution)
    return contribution
