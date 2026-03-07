from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from app.config import settings
from app.db.session import insert_record, json_dumps, utc_now


def build_song(
    source: dict, language: str, aligned_lyrics: list[dict[str, object]]
) -> dict:
    song_id = f"song_{source['id']}_{uuid4().hex[:6]}"
    title = source.get("title") or Path(source.get("original_path") or "song").stem
    artist = source.get("artist") or "unknown"
    playback_url = _playback_url(source.get("original_path"))

    song_payload = {
        "id": song_id,
        "title": title,
        "artist": artist,
        "audio": {
            "sourceId": source["id"],
            "playbackUrl": playback_url,
            "duration": source.get("duration"),
        },
        "lyrics": aligned_lyrics,
    }

    export_path = settings.export_dir / f"{song_id}.json"
    export_path.write_text(json.dumps(song_payload, indent=2, ensure_ascii=True))

    timestamp = utc_now()
    insert_record(
        "songs",
        {
            "id": song_id,
            "source_id": source["id"],
            "title": title,
            "artist": artist,
            "language": language,
            "lyrics_json": json_dumps(song_payload),
            "created_at": timestamp,
            "updated_at": timestamp,
        },
    )
    return song_payload


def _playback_url(original_path: str | None) -> str:
    if not original_path:
        return ""
    path = Path(original_path)
    return f"/media/raw/{path.name}"
