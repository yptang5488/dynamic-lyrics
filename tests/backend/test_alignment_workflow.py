from __future__ import annotations

from fastapi.testclient import TestClient


def test_alignment_requires_ready_source(
    client: TestClient, wait_for_job_completion
) -> None:
    youtube_response = client.post(
        "/api/sources/import-youtube",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
    )
    youtube_response.raise_for_status()
    payload = youtube_response.json()

    response = client.post(
        "/api/alignments",
        json={
            "sourceId": payload["sourceId"],
            "language": "ja",
            "lyricsText": "First line\nSecond line",
        },
    )

    assert response.status_code == 202
    job_payload = wait_for_job_completion(client, response.json()["jobId"])
    assert job_payload["status"] == "failed"
    assert job_payload["errorMessage"] == "source is not ready for alignment"


def test_upload_alignment_and_song_fetch_workflow(
    client: TestClient, test_settings, wait_for_job_completion
) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("lesson.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_payload = upload_response.json()

    assert source_payload["status"] == "ready"
    assert source_payload["type"] == "upload"

    alignment_response = client.post(
        "/api/alignments",
        json={
            "sourceId": source_payload["sourceId"],
            "language": "ja",
            "lyricsText": "First line\nSecond line",
            "translations": ["Line one", "Line two"],
        },
    )
    alignment_response.raise_for_status()
    alignment_payload = alignment_response.json()

    assert alignment_payload["status"] == "queued"

    job_payload = wait_for_job_completion(client, alignment_payload["jobId"])
    assert job_payload["status"] == "done"
    assert job_payload["result"]["songId"].startswith("song_")

    song_id = job_payload["result"]["songId"]
    song_response = client.get(f"/api/songs/{song_id}")
    song_response.raise_for_status()
    song_payload = song_response.json()

    assert song_payload["id"] == song_id
    assert song_payload["title"] == "lesson"
    assert song_payload["audio"]["sourceId"] == source_payload["sourceId"]
    assert song_payload["audio"]["playbackUrl"].endswith(".mp3")
    assert song_payload["audio"]["duration"] == 123.4
    assert len(song_payload["lyrics"]) == 2
    assert song_payload["lyrics"][0]["text"] == "First line"
    assert song_payload["lyrics"][0]["translation"] == "Line one"
    assert song_payload["lyrics"][0]["start"] < song_payload["lyrics"][0]["end"]
    assert song_payload["lyrics"][0]["segments"] == []
    assert song_payload["lyrics"][0]["notes"] == []

    export_path = test_settings.export_dir / f"{song_id}.json"
    assert export_path.exists()


def test_upload_lrc_import_and_song_fetch_workflow(
    client: TestClient, test_settings, wait_for_job_completion
) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("bangbang.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_payload = upload_response.json()

    lrc_response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_payload["sourceId"],
            "language": "ko",
            "lrcText": "\n".join(
                [
                    "[00:08.000]이미 알아차렸겠지",
                    "[00:10.000]应该早就已经察觉",
                    "[00:10.000]그치 언니",
                    "[00:11.000]对吧姐姐",
                ]
            ),
        },
    )
    lrc_response.raise_for_status()

    job_payload = wait_for_job_completion(client, lrc_response.json()["jobId"])
    assert job_payload["status"] == "done"
    assert job_payload["id"].startswith("job_")
    assert job_payload["type"] == "lrc_import"

    song_id = job_payload["result"]["songId"]
    song_payload = client.get(f"/api/songs/{song_id}").json()

    assert song_payload["audio"]["sourceId"] == source_payload["sourceId"]
    assert song_payload["lyrics"] == [
        {
            "id": "l1",
            "start": 8.0,
            "end": 10.0,
            "text": "이미 알아차렸겠지",
            "translation": "应该早就已经察觉",
            "confidence": 0.98,
            "segments": [],
            "notes": [],
        },
        {
            "id": "l2",
            "start": 10.0,
            "end": 11.0,
            "text": "그치 언니",
            "translation": "对吧姐姐",
            "confidence": 0.98,
            "segments": [],
            "notes": [],
        },
    ]

    export_path = test_settings.export_dir / f"{song_id}.json"
    assert export_path.exists()


def test_lrc_import_includes_correction_metadata_when_enabled(
    client: TestClient, test_settings, wait_for_job_completion, monkeypatch
) -> None:
    import app.services.lrc_correction as correction_module
    from app.config import Settings
    from app.services.lrc_correction import TranscriptSegment

    monkeypatch.setattr(
        correction_module,
        "settings",
        Settings(lrc_correction_mode="whisperx_global", lrc_min_anchor_count=2),
    )
    monkeypatch.setattr(
        correction_module,
        "transcribe_with_whisperx",
        lambda audio_path, language: [
            TranscriptSegment(start=9.0, end=10.0, text="이미 알아차렸겠지"),
            TranscriptSegment(start=11.0, end=12.0, text="그치 언니"),
        ],
    )

    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("bangbang.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_payload = upload_response.json()

    lrc_response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_payload["sourceId"],
            "language": "ko",
            "lrcText": "\n".join(
                [
                    "[00:08.000]이미 알아차렸겠지",
                    "[00:10.000]应该早就已经察觉",
                    "[00:10.000]그치 언니",
                    "[00:11.000]对吧姐姐",
                ]
            ),
        },
    )
    lrc_response.raise_for_status()

    job_payload = wait_for_job_completion(client, lrc_response.json()["jobId"])
    assert job_payload["status"] == "done"
    assert job_payload["result"]["correction"]["applied"] is True
    assert job_payload["result"]["correction"]["offsetSeconds"] == 1.0
    assert job_payload["result"]["correction"]["anchorCount"] == 2


def test_get_song_returns_404_for_unknown_song(client: TestClient) -> None:
    response = client.get("/api/songs/song_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "song not found"}
