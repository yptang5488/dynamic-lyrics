from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
NORMALIZED_DIR = DATA_DIR / "normalized"
EXPORT_DIR = DATA_DIR / "export"
DB_PATH = BASE_DIR / "app.db"


@dataclass(frozen=True)
class Settings:
    app_name: str = "Dynamic Lyrics API"
    api_prefix: str = "/api"
    media_prefix: str = "/media"
    db_path: Path = DB_PATH
    raw_dir: Path = RAW_DIR
    normalized_dir: Path = NORMALIZED_DIR
    export_dir: Path = EXPORT_DIR
    lrc_correction_mode: str = "off"
    lrc_min_anchor_count: int = 3
    lrc_max_offset_seconds: float = 12.0

    def ensure_storage(self) -> None:
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.normalized_dir.mkdir(parents=True, exist_ok=True)
        self.export_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
