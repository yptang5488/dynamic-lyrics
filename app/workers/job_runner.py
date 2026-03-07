from __future__ import annotations

import threading
from collections.abc import Callable
from uuid import uuid4

from app.db.session import (
    fetch_one,
    insert_record,
    json_dumps,
    json_loads,
    update_record,
    utc_now,
)
from app.services.aligner_mock import MockAligner
from app.services.lyrics_parser import parse_lyrics
from app.services.song_builder import build_song
from app.services.source_service import fetch_source
from app.services.youtube_import import import_youtube_audio


class JobRunner:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._aligner = MockAligner()

    def submit_youtube_import(self, source_id: str, url: str) -> str:
        job_id = self._create_job(
            job_type="youtube_import",
            source_id=source_id,
            payload={"url": url},
        )
        self._spawn(job_id, self._run_youtube_import)
        return job_id

    def submit_alignment(
        self,
        source_id: str,
        language: str,
        lyrics_text: str,
        translations: list[str] | None,
    ) -> str:
        job_id = self._create_job(
            job_type="alignment",
            source_id=source_id,
            payload={
                "language": language,
                "lyricsText": lyrics_text,
                "translations": translations or [],
            },
        )
        self._spawn(job_id, self._run_alignment)
        return job_id

    def _create_job(self, job_type: str, source_id: str, payload: dict) -> str:
        job_id = f"job_{uuid4().hex[:8]}"
        timestamp = utc_now()
        insert_record(
            "jobs",
            {
                "id": job_id,
                "type": job_type,
                "source_id": source_id,
                "status": "queued",
                "progress": 0,
                "message": None,
                "payload_json": json_dumps(payload),
                "result_json": None,
                "error_message": None,
                "created_at": timestamp,
                "updated_at": timestamp,
            },
        )
        return job_id

    def _spawn(self, job_id: str, target: Callable[[str], None]) -> None:
        thread = threading.Thread(target=target, args=(job_id,), daemon=True)
        thread.start()

    def _run_youtube_import(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return
        payload = json_loads(job["payload_json"], {})
        source_id = job["source_id"]

        try:
            self._set_job(job_id, status="processing", progress=10)
            update_record(
                "sources", source_id, {"status": "processing", "updated_at": utc_now()}
            )
            result = import_youtube_audio(source_id, payload["url"])
            update_record(
                "sources",
                source_id,
                {
                    "status": "ready",
                    "original_path": result["original_path"],
                    "normalized_path": result["normalized_path"],
                    "duration": result["duration"],
                    "title": result["title"],
                    "artist": result["artist"],
                    "updated_at": utc_now(),
                },
            )
            self._set_job(
                job_id,
                status="done",
                progress=100,
                message="import completed",
                result={"sourceId": source_id},
            )
        except Exception as exc:  # noqa: BLE001
            update_record(
                "sources",
                source_id,
                {
                    "status": "failed",
                    "error_message": str(exc),
                    "updated_at": utc_now(),
                },
            )
            self._fail_job(job_id, exc)

    def _run_alignment(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return
        source = fetch_source(job["source_id"])
        if not source:
            self._fail_job(job_id, RuntimeError("source not found"))
            return

        try:
            if source["status"] != "ready":
                raise RuntimeError("source is not ready for alignment")

            payload = json_loads(job["payload_json"], {})
            self._set_job(
                job_id, status="processing", progress=15, message="parsing lyrics"
            )
            parsed_lines = parse_lyrics(
                payload["lyricsText"], payload.get("translations")
            )
            self._set_job(job_id, progress=55, message="building mock timings")
            aligned = self._aligner.align(
                source.get("duration"), parsed_lines, payload["language"]
            )
            self._set_job(job_id, progress=85, message="saving song data")
            song = build_song(source, payload["language"], aligned)
            self._set_job(
                job_id,
                status="done",
                progress=100,
                message="alignment completed",
                result={"songId": song["id"]},
            )
        except Exception as exc:  # noqa: BLE001
            self._fail_job(job_id, exc)

    def _set_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: int | None = None,
        message: str | None = None,
        result: dict | None = None,
    ) -> None:
        with self._lock:
            payload: dict[str, object] = {"updated_at": utc_now()}
            if status is not None:
                payload["status"] = status
            if progress is not None:
                payload["progress"] = progress
            if message is not None:
                payload["message"] = message
            if result is not None:
                payload["result_json"] = json_dumps(result)
            update_record("jobs", job_id, payload)

    def _fail_job(self, job_id: str, exc: Exception) -> None:
        update_record(
            "jobs",
            job_id,
            {
                "status": "failed",
                "progress": 100,
                "message": None,
                "error_message": str(exc),
                "updated_at": utc_now(),
            },
        )

    def get_job(self, job_id: str) -> dict | None:
        return fetch_one("jobs", job_id)


job_runner = JobRunner()
