from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings


TABLES = {"sources", "jobs", "songs"}
_LOCK = threading.RLock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    settings.ensure_storage()
    for table in TABLES:
        _table_dir(table).mkdir(parents=True, exist_ok=True)
    recover_stale_jobs()


def insert_record(table: str, payload: dict[str, Any]) -> None:
    _validate_table(table)
    record_id = payload["id"]
    with _LOCK:
        path = _record_path(table, record_id)
        if path.exists():
            raise ValueError(f"{table} record already exists: {record_id}")
        _write_json(path, payload)


def update_record(table: str, record_id: str, payload: dict[str, Any]) -> None:
    _validate_table(table)
    with _LOCK:
        existing = fetch_one(table, record_id) or {"id": record_id}
        existing.update(payload)
        existing["id"] = record_id
        _write_json(_record_path(table, record_id), existing)


def delete_record(table: str, record_id: str) -> bool:
    _validate_table(table)
    with _LOCK:
        path = _record_path(table, record_id)
        if not path.exists():
            return False
        path.unlink()
        return True


def fetch_one(table: str, record_id: str) -> dict[str, Any] | None:
    _validate_table(table)
    with _LOCK:
        path = _record_path(table, record_id)
        if not path.exists():
            return None
        return _read_json(path)


def fetch_ready_song_rows() -> list[dict[str, Any]]:
    with _LOCK:
        rows: list[dict[str, Any]] = []
        for song in _read_table("songs"):
            source = fetch_one("sources", song.get("source_id", ""))
            if source and source.get("status") == "ready":
                rows.append(song)
    return sorted(rows, key=lambda row: row.get("created_at", ""), reverse=True)


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def recover_stale_jobs() -> None:
    timestamp = utc_now()
    source_ids_to_fail: set[str] = set()

    with _LOCK:
        for job in _read_table("jobs"):
            if job.get("status") not in {"queued", "processing"}:
                continue

            update_record(
                "jobs",
                job["id"],
                {
                    "status": "failed",
                    "progress": 100,
                    "message": None,
                    "error_message": "job interrupted during previous app shutdown",
                    "updated_at": timestamp,
                },
            )
            if job.get("type") in {"youtube_import", "spotify_import"} and job.get(
                "source_id"
            ):
                source_ids_to_fail.add(job["source_id"])

        for source_id in source_ids_to_fail:
            source = fetch_one("sources", source_id)
            if source and source.get("status") in {"queued", "processing"}:
                update_record(
                    "sources",
                    source_id,
                    {
                        "status": "failed",
                        "error_message": "source import interrupted during previous app shutdown",
                        "updated_at": timestamp,
                    },
                )

        for source in _read_table("sources"):
            if (
                source.get("status") == "processing"
                and source.get("type") == "upload"
                and source.get("normalized_path") is None
            ):
                update_record(
                    "sources",
                    source["id"],
                    {
                        "status": "failed",
                        "error_message": "upload processing interrupted during previous app shutdown",
                        "updated_at": timestamp,
                    },
                )


def _read_table(table: str) -> list[dict[str, Any]]:
    _validate_table(table)
    directory = _table_dir(table)
    if not directory.exists():
        return []
    rows: list[dict[str, Any]] = []
    for path in directory.glob("*.json"):
        rows.append(_read_json(path))
    return rows


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    temp_path.replace(path)


def _record_path(table: str, record_id: str) -> Path:
    return _table_dir(table) / f"{record_id}.json"


def _table_dir(table: str) -> Path:
    return settings.raw_dir.parent / table


def _validate_table(table: str) -> None:
    if table not in TABLES:
        raise ValueError(f"unknown table: {table}")
