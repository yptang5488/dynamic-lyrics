from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.config import settings
from app.db.session import fetch_one, insert_record, update_record, utc_now
from app.services.audio_normalize import normalize_audio, probe_duration


def create_uploaded_source(file: UploadFile) -> dict:
    source_id = f"src_{uuid4().hex[:8]}"
    suffix = Path(file.filename or "audio.bin").suffix or ".bin"
    original_path = settings.raw_dir / f"{source_id}{suffix}"
    with original_path.open("wb") as output:
        output.write(file.file.read())

    timestamp = utc_now()
    insert_record(
        "sources",
        {
            "id": source_id,
            "type": "upload",
            "status": "processing",
            "source_url": None,
            "original_path": str(original_path),
            "normalized_path": None,
            "title": Path(file.filename or original_path.name).stem,
            "artist": None,
            "duration": None,
            "error_message": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    normalized_path = normalize_audio(source_id, original_path)
    duration = probe_duration(original_path)
    update_record(
        "sources",
        source_id,
        {
            "status": "ready",
            "normalized_path": str(normalized_path),
            "duration": duration,
            "updated_at": utc_now(),
        },
    )
    source = fetch_source(source_id)
    if source is None:
        raise RuntimeError("created source could not be reloaded")
    return source


def create_pending_youtube_source(url: str) -> dict:
    source_id = f"src_{uuid4().hex[:8]}"
    timestamp = utc_now()
    insert_record(
        "sources",
        {
            "id": source_id,
            "type": "youtube",
            "status": "queued",
            "source_url": url,
            "original_path": None,
            "normalized_path": None,
            "title": None,
            "artist": None,
            "duration": None,
            "error_message": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    source = fetch_source(source_id)
    if source is None:
        raise RuntimeError("created source could not be reloaded")
    return source


def fetch_source(source_id: str) -> dict | None:
    return fetch_one("sources", source_id)
