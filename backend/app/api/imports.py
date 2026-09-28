from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.api.deps import get_session
from app.models.importbatch import ImportBatch
from app.services.import_service import import_phonepe_csv

router = APIRouter(prefix="/api/imports", tags=["imports"])


@router.get("")
def list_imports(session: Session = Depends(get_session)):
    return session.exec(select(ImportBatch).order_by(ImportBatch.imported_at.desc())).all()


@router.post("/phonepe")
async def upload_phonepe_statement(
    file: UploadFile = File(...),
    account_id: int | None = None,
    session: Session = Depends(get_session),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "only CSV PhonePe statements are supported right now")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        batch = import_phonepe_csv(session, tmp_path, file.filename, account_id=account_id)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return batch


@router.get("/{batch_id}")
def get_import(batch_id: int, session: Session = Depends(get_session)):
    batch = session.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(404, "import batch not found")
    return batch
