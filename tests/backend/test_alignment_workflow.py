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


def test_get_song_returns_404_for_unknown_song(client: TestClient) -> None:
    response = client.get("/api/songs/song_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "song not found"}
