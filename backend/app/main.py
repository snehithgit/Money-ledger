from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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


# --- Serve the built frontend from the same container/process -------
#
# The single-image Dockerfile (see /Dockerfile at the repo root) builds
# the React app and copies its output here. In that image this
# directory exists and the app serves both the API and the UI on one
# port. Running the backend alone (e.g. `uvicorn app.main:app` during
# local development against a separate `npm run dev` server) just
# means this directory doesn't exist yet - the API still works fine,
# there's simply no UI to serve from here.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "static"

if _FRONTEND_DIST.is_dir():
    _ASSETS_DIR = _FRONTEND_DIST / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        """Single-page app fallback: serve a real static file if the
        path matches one (favicon, manifest, etc.), otherwise hand back
        index.html so React Router can handle client-side routes like
        /transactions or /commitments. Registered last, so every /api/*
        route above always takes precedence over this catch-all."""
        candidate = _FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
