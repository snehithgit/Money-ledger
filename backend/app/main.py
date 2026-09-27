from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.api import accounts, categories, commitments, counterparties, goals, imports, labels, review, reports, rules, transactions
from app.core import db
from app.core.config import settings
from app.core.db import init_db
from app.services.seed import seed_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Reference db.engine dynamically (not a top-level `from ... import
    # engine`) so tests can swap in an isolated in-memory SQLite engine
    # per test before the lifespan runs - see backend/tests/conftest.py.
    with Session(db.engine) as session:
        seed_all(session)
    yield


app = FastAPI(title="Personal Finance Tracker", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(labels.router)
app.include_router(counterparties.router)
app.include_router(transactions.router)
app.include_router(rules.router)
app.include_router(commitments.router)
app.include_router(goals.router)
app.include_router(imports.router)
app.include_router(review.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
