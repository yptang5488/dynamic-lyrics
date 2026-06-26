from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from app.db.session import json_loads  # noqa: E402
from app.services.chant_romanization import normalize_chant_events, normalize_lyric_notes  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Export song payloads from data/songs to data/export.")
    parser.add_argument("--songs", help="Comma-separated song ids to export. Defaults to all songs.")
    args = parser.parse_args()

    selected_song_ids = {song_id.strip() for song_id in (args.songs or "").split(",") if song_id.strip()}
    songs_dir = ROOT_DIR / "data" / "songs"
    export_dir = ROOT_DIR / "data" / "export"
    export_dir.mkdir(parents=True, exist_ok=True)

    exported = 0
    for song_path in sorted(songs_dir.glob("*.json")):
        record = json.loads(song_path.read_text(encoding="utf-8"))
        payload = load_song_payload(record)
        song_id = payload.get("id")
        if not isinstance(song_id, str):
            raise ValueError(f"song payload in {song_path} is missing id")
        if selected_song_ids and song_id not in selected_song_ids:
            continue

        payload = normalize_song_payload(payload)
        (export_dir / f"{song_id}.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        exported += 1

    if not exported:
        raise SystemExit("No songs were exported")
    print(f"Exported {exported} song(s) to {export_dir.relative_to(ROOT_DIR)}")


def load_song_payload(record: dict[str, Any]) -> dict[str, Any]:
    lyrics_json = record.get("lyrics_json")
    if isinstance(lyrics_json, str):
        payload = json_loads(lyrics_json, {})
        if isinstance(payload, dict):
            return payload
    raise ValueError(f"song record {record.get('id', '<unknown>')} has invalid lyrics_json")


def normalize_song_payload(payload: dict[str, Any]) -> dict[str, Any]:
    next_payload = dict(payload)
    lyrics = next_payload.get("lyrics")
    chant_events = next_payload.get("chantEvents")
    if isinstance(lyrics, list):
        next_payload["lyrics"] = normalize_lyric_notes(lyrics)
    if isinstance(chant_events, list):
        next_payload["chantEvents"] = normalize_chant_events(chant_events)
    return next_payload


if __name__ == "__main__":
    main()
