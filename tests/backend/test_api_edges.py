from __future__ import annotations

from app.db.session import insert_record, utc_now


def test_get_source_returns_uploaded_source_details(client) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("edge-case.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_id = upload_response.json()["sourceId"]

    response = client.get(f"/api/sources/{source_id}")
    response.raise_for_status()
    payload = response.json()

    assert payload["id"] == source_id
    assert payload["type"] == "upload"
    assert payload["status"] == "ready"
    assert payload["title"] == "edge-case"
    assert payload["duration"] == 123.4
    assert payload["errorMessage"] is None


def test_get_source_returns_404_for_unknown_source(client) -> None:
    response = client.get("/api/sources/src_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "source not found"}


def test_get_job_returns_404_for_unknown_job(client) -> None:
    response = client.get("/api/jobs/job_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "job not found"}


def test_import_youtube_rejects_invalid_url_payload(client) -> None:
    response = client.post("/api/sources/import-youtube", json={"url": "not-a-url"})

    assert response.status_code == 422


def test_import_youtube_sanitizes_short_url_in_job_flow(
    client, wait_for_job_completion, monkeypatch
) -> None:
    captured: dict[str, str] = {}

    def fake_import_youtube_audio(source_id: str, url: str):
        captured["source_id"] = source_id
        captured["url"] = url
        raise RuntimeError("simulated youtube import failure")

    monkeypatch.setattr(
        "app.workers.job_runner.import_youtube_audio", fake_import_youtube_audio
    )

    response = client.post(
        "/api/sources/import-youtube",
        json={"url": "https://youtu.be/abc123xyz?t=99"},
    )
    response.raise_for_status()
    payload = response.json()

    job_payload = wait_for_job_completion(client, payload["jobId"])
    source_payload = client.get(f"/api/sources/{payload['sourceId']}").json()

    assert captured == {
        "source_id": payload["sourceId"],
        "url": "https://www.youtube.com/watch?v=abc123xyz",
    }
    assert job_payload["status"] == "failed"
    assert job_payload["errorMessage"] == "simulated youtube import failure"
    assert source_payload["status"] == "failed"
    assert source_payload["errorMessage"] == "simulated youtube import failure"


def test_alignment_rejects_missing_source(client) -> None:
    response = client.post(
        "/api/alignments",
        json={
            "sourceId": "src_missing",
            "language": "ja",
            "lyricsText": "First line",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "source not found"}


def test_alignment_rejects_failed_source(client) -> None:
    source_id = "src_failed01"
    timestamp = utc_now()
    insert_record(
        "sources",
        {
            "id": source_id,
            "type": "youtube",
            "status": "failed",
            "source_url": "https://www.youtube.com/watch?v=abc123xyz",
            "original_path": None,
            "normalized_path": None,
            "title": None,
            "artist": None,
            "duration": None,
            "error_message": "download failed",
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.post(
        "/api/alignments",
        json={
            "sourceId": source_id,
            "language": "ja",
            "lyricsText": "First line",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "source failed to import"}


def test_alignment_rejects_empty_lyrics_payload(client) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("blank-lyrics.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_id = upload_response.json()["sourceId"]

    response = client.post(
        "/api/alignments",
        json={
            "sourceId": source_id,
            "language": "ja",
            "lyricsText": "   ",
        },
    )

    assert response.status_code == 422


def test_alignment_job_fails_when_translation_count_mismatches(
    client, wait_for_job_completion
) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("mismatch.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_id = upload_response.json()["sourceId"]

    alignment_response = client.post(
        "/api/alignments",
        json={
            "sourceId": source_id,
            "language": "ja",
            "lyricsText": "First line\nSecond line",
            "translations": ["Only one translation"],
        },
    )
    alignment_response.raise_for_status()

    job_payload = wait_for_job_completion(client, alignment_response.json()["jobId"])

    assert job_payload["status"] == "failed"
    assert (
        job_payload["errorMessage"]
        == "translations count must match non-empty lyric line count"
    )
