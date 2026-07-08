from __future__ import annotations

import json

from app.services.spotdl_import import SpotdlImportResult
from app.db.session import insert_record, json_dumps, utc_now


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


def test_update_song_lyric_offset_persists(client) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_offset_case",
        "title": "Offset Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_offset_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [],
    }
    insert_record(
        "songs",
        {
            "id": "song_offset_case",
            "source_id": "src_offset_case",
            "title": "Offset Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.patch(
        "/api/songs/song_offset_case/lyric-offset", json={"lyricOffset": 1.24}
    )
    response.raise_for_status()

    assert response.json()["lyricOffset"] == 1.2
    assert client.get("/api/songs/song_offset_case").json()["lyricOffset"] == 1.2


def test_shift_song_timing_persists_from_line_onward(client, test_settings) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_shift_case",
        "title": "Shift Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_shift_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [
            {
                "id": "l1",
                "start": 1,
                "end": 2,
                "text": "before",
                "translation": None,
                "confidence": 0.9,
                "segments": [],
                "notes": [],
            },
            {
                "id": "l2",
                "start": 3,
                "end": 4,
                "text": "shift me",
                "translation": None,
                "confidence": 0.9,
                "segments": [{"start": 3.1, "end": 3.4, "text": "shift"}],
                "notes": [],
            },
        ],
    }
    insert_record(
        "songs",
        {
            "id": "song_shift_case",
            "source_id": "src_shift_case",
            "title": "Shift Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.patch(
        "/api/songs/song_shift_case/timing-shift",
        json={"fromLineId": "l2", "offset": 12.5},
    )
    response.raise_for_status()

    lyrics = response.json()["lyrics"]
    assert lyrics[0]["start"] == 1
    assert lyrics[1]["start"] == 15.5
    assert lyrics[1]["segments"][0]["start"] == 15.6
    persisted = client.get("/api/songs/song_shift_case").json()["lyrics"]
    assert persisted[1]["end"] == 16.5
    export_payload = json.loads((test_settings.export_dir / "song_shift_case.json").read_text(encoding="utf-8"))
    assert export_payload["lyrics"][1]["start"] == 15.5
    assert list((test_settings.raw_dir.parent / "backups" / "songs").glob("song_shift_case.*.json"))


def test_update_song_metadata_persists(client) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_metadata_case",
        "title": "Old Title",
        "artist": "Old Artist",
        "audio": {"sourceId": "src_metadata_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [],
    }
    insert_record(
        "sources",
        {
            "id": "src_metadata_case",
            "type": "upload",
            "status": "ready",
            "title": "Old Title",
            "artist": "Old Artist",
            "playback_url": "/media/test.mp3",
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    insert_record(
        "songs",
        {
            "id": "song_metadata_case",
            "source_id": "src_metadata_case",
            "title": "Old Title",
            "artist": "Old Artist",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.patch(
        "/api/songs/song_metadata_case/metadata",
        json={"title": " New Title ", "artist": " New Artist ", "trimStart": 31.04, "trimEnd": 38},
    )
    response.raise_for_status()

    assert response.json()["title"] == "New Title"
    assert response.json()["artist"] == "New Artist"
    assert response.json()["audio"]["trimStart"] == 31.0
    assert response.json()["audio"]["trimEnd"] == 38.0
    assert client.get("/api/songs/song_metadata_case").json()["title"] == "New Title"
    catalog_entry = next(
        song for song in client.get("/api/songs").json() if song["id"] == "song_metadata_case"
    )
    assert catalog_entry["title"] == "New Title"
    assert catalog_entry["artist"] == "New Artist"


def test_update_song_lyric_notes_persists(client) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_notes_case",
        "title": "Notes Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_notes_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [
            {
                "id": "l1",
                "start": 0,
                "end": 1,
                "text": "hello world",
                "translation": None,
                "confidence": 0.9,
                "segments": [],
                "notes": [],
            }
        ],
    }
    insert_record(
        "songs",
        {
            "id": "song_notes_case",
            "source_id": "src_notes_case",
            "title": "Notes Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    note = {
        "type": "chant",
        "mode": "inline",
        "label": "sing-along",
        "text": "hello",
        "placement": "inline",
        "anchor": {"matchText": "hello", "occurrence": 1, "charStart": 0, "charEnd": 5},
    }
    response = client.patch(
        "/api/songs/song_notes_case/lyric-notes",
        json={"lyricNotes": [{"lineId": "l1", "notes": [note]}]},
    )
    response.raise_for_status()

    assert response.json()["lyrics"][0]["notes"] == [note]
    assert client.get("/api/songs/song_notes_case").json()["lyrics"][0]["notes"] == [note]


def test_song_chant_events_are_returned_and_count_as_notes(client) -> None:
    timestamp = utc_now()
    chant_event = {
        "id": "c1",
        "start": 5,
        "end": 8,
        "text": "intro chant",
        "label": "chant",
    }
    song_payload = {
        "id": "song_chant_event_case",
        "title": "Chant Event Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_chant_event_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [],
        "chantEvents": [chant_event],
    }
    insert_record(
        "sources",
        {
            "id": "src_chant_event_case",
            "type": "upload",
            "status": "ready",
            "title": "Chant Event Case",
            "artist": "Tester",
            "playback_url": "/media/test.mp3",
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    insert_record(
        "songs",
        {
            "id": "song_chant_event_case",
            "source_id": "src_chant_event_case",
            "title": "Chant Event Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.get("/api/songs/song_chant_event_case")
    response.raise_for_status()

    assert response.json()["chantEvents"] == [{**chant_event, "romanizedText": None}]
    catalog_entry = next(
        song for song in client.get("/api/songs").json() if song["id"] == "song_chant_event_case"
    )
    assert catalog_entry["hasNotes"] is True


def test_update_song_chant_events_persists_sorted_events(client, test_settings) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_chant_events_update_case",
        "title": "Chant Events Update Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_chant_events_update_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [],
    }
    insert_record(
        "songs",
        {
            "id": "song_chant_events_update_case",
            "source_id": "src_chant_events_update_case",
            "title": "Chant Events Update Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.patch(
        "/api/songs/song_chant_events_update_case/chant-events",
        json={
            "chantEvents": [
                {"id": "outro", "start": 20, "end": 25, "text": "outro", "label": "chant"},
                {"id": "intro", "start": 0, "end": 5, "text": "intro", "label": "chant"},
            ]
        },
    )
    response.raise_for_status()

    assert [event["id"] for event in response.json()["chantEvents"]] == ["intro", "outro"]
    assert [event["id"] for event in client.get("/api/songs/song_chant_events_update_case").json()["chantEvents"]] == ["intro", "outro"]
    export_payload = json.loads(
        (test_settings.export_dir / "song_chant_events_update_case.json").read_text(
            encoding="utf-8"
        )
    )
    assert [event["id"] for event in export_payload["chantEvents"]] == ["intro", "outro"]


def test_update_song_lyric_notes_normalizes_chant_romanization(client) -> None:
    timestamp = utc_now()
    song_payload = {
        "id": "song_romanized_notes_case",
        "title": "Romanized Notes Case",
        "artist": "Tester",
        "audio": {"sourceId": "src_romanized_notes_case", "playbackUrl": "/media/test.mp3"},
        "lyrics": [
            {
                "id": "l1",
                "start": 0,
                "end": 1,
                "text": "hello world",
                "translation": None,
                "confidence": 0.9,
                "segments": [],
                "notes": [],
            }
        ],
    }
    insert_record(
        "songs",
        {
            "id": "song_romanized_notes_case",
            "source_id": "src_romanized_notes_case",
            "title": "Romanized Notes Case",
            "artist": "Tester",
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )

    response = client.patch(
        "/api/songs/song_romanized_notes_case/lyric-notes",
        json={
            "lyricNotes": [
                {
                    "lineId": "l1",
                    "notes": [
                        {"type": "chant", "text": "김용선"},
                        {"type": "chant", "text": "drop drop drop", "romanizedText": "stale"},
                    ],
                }
            ]
        },
    )
    response.raise_for_status()

    assert response.json()["lyrics"][0]["notes"] == [
        {"type": "chant", "text": "김용선", "romanizedText": "金容仙"},
        {"type": "chant", "text": "drop drop drop"},
    ]


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


def test_import_youtube_uses_youtube_title_for_source_metadata(
    client, wait_for_job_completion, monkeypatch
) -> None:
    def fake_import_youtube_audio(source_id: str, url: str):
        return {
            "original_path": f"/tmp/{source_id}.mp3",
            "normalized_path": f"/tmp/{source_id}.wav",
            "duration": 244.0,
            "title": "마마무(MAMAMOO) '4 Flowers' MV",
            "artist": None,
        }

    monkeypatch.setattr(
        "app.workers.job_runner.import_youtube_audio", fake_import_youtube_audio
    )

    response = client.post(
        "/api/sources/import-youtube",
        json={"url": "https://www.youtube.com/watch?v=abc123xyz"},
    )
    response.raise_for_status()
    payload = response.json()

    job_payload = wait_for_job_completion(client, payload["jobId"])
    source_payload = client.get(f"/api/sources/{payload['sourceId']}").json()

    assert job_payload["status"] == "done"
    assert source_payload["title"] == "마마무(MAMAMOO) '4 Flowers' MV"


def test_import_spotify_downloads_source_and_returns_lrc_preview(
    client, test_settings, wait_for_job_completion, monkeypatch
) -> None:
    captured: dict[str, str] = {}

    def fake_import_spotify_audio(source_id: str, query: str) -> SpotdlImportResult:
        captured["source_id"] = source_id
        captured["query"] = query
        output_dir = test_settings.raw_dir / f"{source_id}_spotdl"
        output_dir.mkdir(parents=True, exist_ok=True)
        audio_path = output_dir / "NewJeans - Cookie.mp3"
        lyrics_path = output_dir / "NewJeans - Cookie.lrc"
        audio_path.write_bytes(b"fake audio bytes")
        lyrics_path.write_text(
            "\n".join(
                [
                    "[ti:Cookie]",
                    "[ar:NewJeans]",
                    "[00:01.000]Made a little cookie",
                    "[00:03.000]做了一塊小餅乾",
                ]
            ),
            encoding="utf-8",
        )
        return SpotdlImportResult(
            audio_path=audio_path,
            lyrics_path=lyrics_path,
            output_dir=output_dir,
        )

    monkeypatch.setattr(
        "app.workers.job_runner.import_spotify_audio", fake_import_spotify_audio
    )

    response = client.post(
        "/api/sources/import-spotify",
        json={"query": "NEWJEANS - Cookie"},
    )
    response.raise_for_status()
    payload = response.json()

    job_payload = wait_for_job_completion(client, payload["jobId"])
    source_payload = client.get(f"/api/sources/{payload['sourceId']}").json()

    assert captured == {
        "source_id": payload["sourceId"],
        "query": "NEWJEANS - Cookie",
    }
    assert payload["status"] == "queued"
    assert job_payload["status"] == "done"
    assert job_payload["type"] == "spotify_import"
    assert job_payload["result"]["sourceId"] == payload["sourceId"]
    assert job_payload["result"]["hasGeneratedLrc"] is True
    assert "[ti:Cookie]" in job_payload["result"]["lrcText"]
    assert "songId" not in job_payload["result"]
    assert source_payload["type"] == "spotify"
    assert source_payload["status"] == "ready"
    assert source_payload["title"] == "NewJeans - Cookie"
    assert source_payload["artist"] is None


def test_import_spotify_job_failure_marks_source_failed(
    client, wait_for_job_completion, monkeypatch
) -> None:
    def fake_import_spotify_audio(source_id: str, query: str) -> SpotdlImportResult:
        raise RuntimeError("simulated spotify import failure")

    monkeypatch.setattr(
        "app.workers.job_runner.import_spotify_audio", fake_import_spotify_audio
    )

    response = client.post(
        "/api/sources/import-spotify",
        json={"query": "NEWJEANS - Cookie"},
    )
    response.raise_for_status()
    payload = response.json()

    job_payload = wait_for_job_completion(client, payload["jobId"])
    source_payload = client.get(f"/api/sources/{payload['sourceId']}").json()

    assert job_payload["status"] == "failed"
    assert job_payload["errorMessage"] == "simulated spotify import failure"
    assert source_payload["status"] == "failed"
    assert source_payload["errorMessage"] == "simulated spotify import failure"


def test_import_spotify_rejects_empty_query(client) -> None:
    response = client.post(
        "/api/sources/import-spotify",
        json={"query": "   "},
    )

    assert response.status_code == 422


def test_search_synced_lrc_returns_lrc_preview(client, monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_fetch_synced_lrc(query: str, providers: list[str] | None = None) -> str:
        captured["query"] = query
        captured["providers"] = providers
        return "[00:01.00]First line"

    monkeypatch.setattr(
        "app.api.routes_lyrics.fetch_synced_lrc", fake_fetch_synced_lrc
    )

    response = client.post(
        "/api/lyrics/search-synced",
        json={"query": "MAMAMOO 4 flowers", "providers": ["Lrclib"]},
    )
    response.raise_for_status()
    payload = response.json()

    assert captured == {"query": "MAMAMOO 4 flowers", "providers": ["Lrclib"]}
    assert payload["lrcText"] == "[00:01.00]First line"
    assert payload["warnings"]


def test_search_synced_lrc_rejects_empty_query(client) -> None:
    response = client.post("/api/lyrics/search-synced", json={"query": "   "})

    assert response.status_code == 422


def test_lrc_import_rejects_missing_source(client) -> None:
    response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": "src_missing",
            "lrcText": "[00:01.00]First line",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "source not found"}


def test_lrc_import_rejects_failed_source(client) -> None:
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
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_id,
            "lrcText": "[00:01.00]First line",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "source failed to import"}


def test_lrc_import_rejects_empty_lrc_payload(client) -> None:
    upload_response = client.post(
        "/api/sources/upload-audio",
        files={"file": ("blank-lyrics.mp3", b"fake audio bytes", "audio/mpeg")},
    )
    upload_response.raise_for_status()
    source_id = upload_response.json()["sourceId"]

    response = client.post(
        "/api/alignments/from-lrc",
        json={
            "sourceId": source_id,
            "lrcText": "   ",
        },
    )

    assert response.status_code == 422
