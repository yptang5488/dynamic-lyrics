from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.db.session import fetch_one, insert_record, json_dumps, utc_now


def test_list_songs_returns_empty_library(client: TestClient) -> None:
    response = client.get("/api/songs")
    response.raise_for_status()

    assert response.json() == []


def test_upload_lrc_import_and_song_fetch_workflow(
    client: TestClient, test_settings, wait_for_job_completion
) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("bangbang.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_payload = upload_response.json()

    assert source_payload["status"] == "ready"
    assert source_payload["type"] == "upload"

    lrc_response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_payload["sourceId"],
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
    assert job_payload["result"]["songId"].startswith("song_")

    song_id = job_payload["result"]["songId"]
    song_response = client.get(f"/api/songs/{song_id}")
    song_response.raise_for_status()
    song_payload = song_response.json()

    assert song_payload["id"] == song_id
    assert song_payload["audio"]["sourceId"] == source_payload["sourceId"]
    assert song_payload["audio"]["playbackUrl"].endswith(".mp3")
    assert song_payload["audio"]["duration"] == 123.4
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


def test_list_songs_returns_catalog_entries(
    client: TestClient, wait_for_job_completion
) -> None:
    song_id = create_lrc_song(client, wait_for_job_completion, filename="lesson.mp3")

    response = client.get("/api/songs")
    response.raise_for_status()

    assert response.json() == [
        {
            "id": song_id,
            "title": "lesson",
            "artist": "unknown",
            "hasLyrics": True,
            "hasTranslation": True,
            "hasNotes": False,
            "playerPath": f"/player/{song_id}",
        }
    ]


def test_delete_song_removes_it_from_catalog(
    client: TestClient, test_settings, wait_for_job_completion
) -> None:
    song_id = create_lrc_song(client, wait_for_job_completion, filename="duplicate.mp3")
    export_path = test_settings.export_dir / f"{song_id}.json"
    chant_guide_path = test_settings.raw_dir.parent / "chant-guides" / f"{song_id}.json"
    chant_source_path = test_settings.raw_dir.parent / "chant-sources" / f"{song_id}.md"
    chant_guide_path.parent.mkdir(parents=True)
    chant_source_path.parent.mkdir(parents=True)
    chant_guide_path.write_text("{}", encoding="utf-8")
    chant_source_path.write_text("guide", encoding="utf-8")
    source_id = client.get(f"/api/songs/{song_id}").json()["audio"]["sourceId"]
    source = fetch_one("sources", source_id)
    assert source is not None
    original_path = Path(source["original_path"])
    normalized_path = Path(source["normalized_path"])

    delete_response = client.delete(f"/api/songs/{song_id}")

    assert delete_response.status_code == 204
    assert client.get(f"/api/songs/{song_id}").status_code == 404
    assert client.get("/api/songs").json() == []
    assert not export_path.exists()
    assert not chant_guide_path.exists()
    assert not chant_source_path.exists()
    assert fetch_one("sources", source_id) is None
    assert not original_path.exists()
    assert not normalized_path.exists()


def test_delete_song_keeps_shared_source_files(
    client: TestClient, wait_for_job_completion
) -> None:
    song_id = create_lrc_song(client, wait_for_job_completion, filename="shared.mp3")
    song = client.get(f"/api/songs/{song_id}").json()
    source_id = song["audio"]["sourceId"]
    source = fetch_one("sources", source_id)
    assert source is not None
    second_song_id = f"{song_id}_copy"
    timestamp = utc_now()
    insert_record(
        "songs",
        {
            "id": second_song_id,
            "source_id": source_id,
            "title": "shared copy",
            "artist": "unknown",
            "lyrics_json": json_dumps({**song, "id": second_song_id}),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    original_path = Path(source["original_path"])
    normalized_path = Path(source["normalized_path"])

    delete_response = client.delete(f"/api/songs/{song_id}")

    assert delete_response.status_code == 204
    assert fetch_one("sources", source_id) is not None
    assert original_path.exists()
    assert normalized_path.exists()
    assert client.get(f"/api/songs/{second_song_id}").status_code == 200


def test_delete_song_returns_404_for_unknown_song(client: TestClient) -> None:
    response = client.delete("/api/songs/song_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "song not found"}


def test_list_songs_skips_invalid_or_not_ready_records(client: TestClient) -> None:
    timestamp = utc_now()
    insert_record(
        "sources",
        {
            "id": "src_ready",
            "type": "upload",
            "status": "ready",
            "source_url": None,
            "original_path": "/tmp/ready.mp3",
            "normalized_path": None,
            "title": "Ready Song",
            "artist": "Ready Artist",
            "duration": 12.3,
            "error_message": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    insert_record(
        "sources",
        {
            "id": "src_failed",
            "type": "upload",
            "status": "failed",
            "source_url": None,
            "original_path": "/tmp/failed.mp3",
            "normalized_path": None,
            "title": "Failed Song",
            "artist": "Failed Artist",
            "duration": 12.3,
            "error_message": "failed",
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    insert_record(
        "songs",
        {
            "id": "song_invalid",
            "source_id": "src_ready",
            "title": "Invalid Song",
            "artist": "Invalid Artist",
            "lyrics_json": "not json",
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    insert_record(
        "songs",
        {
            "id": "song_not_ready",
            "source_id": "src_failed",
            "title": "Not Ready Song",
            "artist": "Not Ready Artist",
            "lyrics_json": json_dumps(
                {
                    "id": "song_not_ready",
                    "title": "Not Ready Song",
                    "artist": "Not Ready Artist",
                    "audio": {
                        "sourceId": "src_failed",
                        "playbackUrl": "/media/raw/failed.mp3",
                        "duration": 12.3,
                    },
                    "lyrics": [],
                }
            ),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.get("/api/songs")
    response.raise_for_status()

    assert response.json() == []


def create_lrc_song(
    client: TestClient, wait_for_job_completion, *, filename: str = "lesson.mp3"
) -> str:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": (filename, b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_payload = upload_response.json()

    lrc_response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_payload["sourceId"],
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
    return job_payload["result"]["songId"]


def test_get_song_returns_404_for_unknown_song(client: TestClient) -> None:
    response = client.get("/api/songs/song_missing")

    assert response.status_code == 404
    assert response.json() == {"detail": "song not found"}
