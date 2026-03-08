from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from app.config import settings
from app.db.tables import JOB_TABLE_SQL, SONG_TABLE_SQL, SOURCE_TABLE_SQL


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    settings.ensure_storage()
    with get_connection() as connection:
        connection.execute(SOURCE_TABLE_SQL)
        connection.execute(JOB_TABLE_SQL)
        connection.execute(SONG_TABLE_SQL)
        _ensure_job_message_column(connection)
        recover_stale_jobs(connection)
        connection.commit()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(settings.db_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def insert_record(table: str, payload: dict[str, Any]) -> None:
    columns = ", ".join(payload.keys())
    placeholders = ", ".join([":" + key for key in payload])
    with get_connection() as connection:
        connection.execute(
            f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
            payload,
        )
        connection.commit()


def update_record(table: str, record_id: str, payload: dict[str, Any]) -> None:
    payload = dict(payload)
    payload["id"] = record_id
    assignments = ", ".join([f"{key} = :{key}" for key in payload if key != "id"])
    with get_connection() as connection:
        connection.execute(
            f"UPDATE {table} SET {assignments} WHERE id = :id",
            payload,
        )
        connection.commit()


def fetch_one(table: str, record_id: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            f"SELECT * FROM {table} WHERE id = ?",
            (record_id,),
        ).fetchone()
    return dict(row) if row else None


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    return json.loads(value)


def recover_stale_jobs(connection: sqlite3.Connection | None = None) -> None:
    if connection is not None:
        _recover_stale_jobs(connection)
        return

    with get_connection() as managed_connection:
        _recover_stale_jobs(managed_connection)
        managed_connection.commit()


def _ensure_job_message_column(connection: sqlite3.Connection) -> None:
    columns = {
        row[1] for row in connection.execute("PRAGMA table_info(jobs)").fetchall()
    }
    if "message" not in columns:
        connection.execute("ALTER TABLE jobs ADD COLUMN message TEXT")


def _recover_stale_jobs(connection: sqlite3.Connection) -> None:
    timestamp = utc_now()
    stale_jobs = connection.execute(
        "SELECT id, type, source_id FROM jobs WHERE status IN ('queued', 'processing')"
    ).fetchall()

    if not stale_jobs:
        return

    source_ids_to_fail: set[str] = set()
    for job in stale_jobs:
        connection.execute(
            """
            UPDATE jobs
            SET status = ?,
                progress = ?,
                message = NULL,
                error_message = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                "failed",
                100,
                "job interrupted during previous app shutdown",
                timestamp,
                job["id"],
            ),
        )
        if job["type"] == "youtube_import" and job["source_id"]:
            source_ids_to_fail.add(job["source_id"])

    for source_id in source_ids_to_fail:
        connection.execute(
            """
            UPDATE sources
            SET status = ?,
                error_message = ?,
                updated_at = ?
            WHERE id = ? AND status IN ('queued', 'processing')
            """,
            (
                "failed",
                "youtube import interrupted during previous app shutdown",
                timestamp,
                source_id,
            ),
        )

    connection.execute(
        """
        UPDATE sources
        SET status = ?,
            error_message = ?,
            updated_at = ?
        WHERE status = 'processing'
          AND type = 'upload'
          AND normalized_path IS NULL
        """,
        (
            "failed",
            "upload processing interrupted during previous app shutdown",
            timestamp,
        ),
    )
