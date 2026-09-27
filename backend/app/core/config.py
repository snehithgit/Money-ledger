"""
Application configuration.

Kept deliberately tiny: this app has no cloud dependencies and no
required secrets. The only configurable thing is where the SQLite
database file lives, so it can be pointed at a mounted Docker volume.
"""
from __future__ import annotations

import os
from pathlib import Path


class Settings:
    # Directory where the SQLite DB file and raw import archives live.
    # In Docker this is a mounted volume (see docker-compose.yml) so
    # data survives container rebuilds.
    data_dir: Path = Path(os.environ.get("FINANCE_DATA_DIR", "/data"))

    @property
    def db_path(self) -> Path:
        return self.data_dir / "finance.db"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def raw_imports_dir(self) -> Path:
        return self.data_dir / "raw_imports"

    cors_origins: list[str] = ["*"]  # local-only app; no cloud exposure


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.raw_imports_dir.mkdir(parents=True, exist_ok=True)
