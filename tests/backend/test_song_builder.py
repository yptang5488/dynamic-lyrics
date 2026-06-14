from __future__ import annotations

import json

from app.services.song_builder import build_song


def test_build_song_persists_export_and_expected_payload_shape(test_settings) -> None:
    source = {
        "id": "src_test1234",
        "original_path": str(test_settings.raw_dir / "sample.mp3"),
        "duration": 123.4,
        "title": "Sample Song",
        "artist": "Sample Artist",
    }
    aligned_lyrics = [
        {
            "id": "l1",
            "start": 0.0,
            "end": 3.2,
            "text": "First line",
            "translation": "First translation",
            "confidence": 0.55,
            "segments": [],
            "notes": [],
        }
    ]

    song = build_song(source, aligned_lyrics)

    assert song["title"] == "Sample Song"
    assert song["artist"] == "Sample Artist"
    assert song["audio"] == {
        "sourceId": "src_test1234",
        "playbackUrl": "/media/raw/sample.mp3",
        "duration": 123.4,
    }
    assert song["lyrics"][0]["text"] == "First line"
    assert song["lyrics"][0]["segments"] == []
    assert song["lyrics"][0]["notes"] == []

    export_path = test_settings.export_dir / f"{song['id']}.json"
    assert export_path.exists()
    assert json.loads(export_path.read_text()) == song


def test_build_song_preserves_nested_raw_media_url(test_settings) -> None:
    source = {
        "id": "src_spotify1",
        "original_path": str(test_settings.raw_dir / "src_spotify1_spotdl" / "NewJeans - Cookie.mp3"),
        "duration": 123.4,
        "title": "Cookie",
        "artist": "NewJeans",
    }

    song = build_song(source, [])

    assert song["audio"]["playbackUrl"] == "/media/raw/src_spotify1_spotdl/NewJeans%20-%20Cookie.mp3"
