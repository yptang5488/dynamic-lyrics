from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import json_dumps, json_loads  # noqa: E402
from app.services.chant_romanization import normalize_chant_notes  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate or apply a chant-guide.v1 file to a song payload.")
    parser.add_argument("guide", type=Path, help="Path to data/chant-guides/{songId}.json")
    parser.add_argument("--apply", action="store_true", help="Write safe chant notes into the song payload.")
    parser.add_argument("--song", type=Path, help="Override song JSON path. Defaults to data/songs/{songId}.json.")
    parser.add_argument("--report", type=Path, help="Write dry-run/apply report JSON to this path.")
    args = parser.parse_args()

    guide = read_json(args.guide)
    song_id = require_string(guide, "songId")
    song_path = args.song or ROOT / "data" / "songs" / f"{song_id}.json"
    song_record = read_json(song_path)
    payload = json_loads(song_record.get("lyrics_json"), {})

    result = build_import_result(guide, payload)
    if args.apply:
        apply_result(args.guide, guide, song_path, song_record, payload, result)

    report = json.dumps(result, indent=2, ensure_ascii=False)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report + "\n", encoding="utf-8")
    print(report)


def build_import_result(guide: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    lines = payload.get("lyrics", [])
    if not isinstance(lines, list):
        raise ValueError("song payload lyrics must be a list")

    applied: list[dict[str, Any]] = []
    needs_review: list[dict[str, Any]] = []
    line_updates: dict[str, list[dict[str, Any]]] = {}

    for index, entry in enumerate(guide.get("guideLines", []), start=1):
        if not isinstance(entry, dict):
            needs_review.append(review(index, "guide line must be an object", None, None, entry))
            continue

        notes = entry.get("notes", [])
        if not notes:
            continue
        if not isinstance(notes, list):
            needs_review.append(review(index, "notes must be a list", None, None, entry))
            continue

        matched_line, reason = match_line(entry, lines)
        if matched_line is None:
            needs_review.append(review(index, reason, None, entry.get("lineMatchText"), entry))
            continue

        invalid_anchor = first_invalid_anchor(notes, matched_line)
        if invalid_anchor:
            needs_review.append(review(index, invalid_anchor, matched_line, entry.get("lineMatchText"), entry))
            continue

        line_id = str(matched_line["id"])
        line_updates.setdefault(line_id, []).extend(normalize_chant_notes([dict(note) for note in notes]))
        applied.append({"guideLineIndex": index, "lineId": line_id, "notesAdded": len(notes)})

    return {
        "status": "ok" if not needs_review else "needsReview",
        "appliedChanges": applied,
        "needsReview": needs_review,
        "lineUpdates": line_updates,
    }


def apply_result(
    guide_path: Path,
    guide: dict[str, Any],
    song_path: Path,
    song_record: dict[str, Any],
    payload: dict[str, Any],
    result: dict[str, Any],
) -> None:
    backup_path = backup_song(song_path)
    line_updates = result["lineUpdates"]
    for line in payload["lyrics"]:
        line_id = line.get("id")
        if line_id not in line_updates:
            continue
        existing = [note for note in line.get("notes", []) if not (isinstance(note, dict) and note.get("type") == "chant")]
        line["notes"] = existing + line_updates[line_id]

    song_record["lyrics_json"] = json_dumps(payload)
    song_record["updated_at"] = datetime.now(timezone.utc).isoformat()
    write_json(song_path, song_record)

    if result["needsReview"]:
        guide["needsReview"] = result["needsReview"]
        write_json(guide_path, guide)
    elif "needsReview" in guide:
        guide.pop("needsReview")
        write_json(guide_path, guide)

    result["backupPath"] = str(backup_path)
    result.pop("lineUpdates", None)


def match_line(entry: dict[str, Any], lines: list[Any]) -> tuple[dict[str, Any] | None, str]:
    line_id = entry.get("lineId")
    line_match_text = entry.get("lineMatchText")
    if line_id is not None:
        candidates = [line for line in lines if isinstance(line, dict) and line.get("id") == line_id]
        if not candidates:
            return None, f"unknown lineId: {line_id}"
        line = candidates[0]
        if isinstance(line_match_text, str) and normalize_text(line.get("text", "")) != normalize_text(line_match_text):
            return None, "lineId text does not match lineMatchText"
        return line, ""

    if not isinstance(line_match_text, str) or not line_match_text.strip():
        return None, "lineId or lineMatchText is required"
    candidates = [line for line in lines if isinstance(line, dict) and normalize_text(line.get("text", "")) == normalize_text(line_match_text)]
    if len(candidates) != 1:
        return None, f"lineMatchText matched {len(candidates)} lines"
    return candidates[0], ""


def first_invalid_anchor(notes: list[Any], line: dict[str, Any]) -> str | None:
    text = str(line.get("text", ""))
    for note in notes:
        if not isinstance(note, dict):
            return "note must be an object"
        anchor = note.get("anchor")
        if anchor is None:
            continue
        if not isinstance(anchor, dict):
            return "anchor must be an object or null"
        start = anchor.get("charStart")
        end = anchor.get("charEnd")
        match_text = anchor.get("matchText", "")
        if not isinstance(start, int) or not isinstance(end, int) or not isinstance(match_text, str):
            return "anchor charStart, charEnd, and matchText are required"
        if start < 0 or end < start or end > len(text):
            return "anchor range is outside lyric text"
        if text[start:end] != match_text:
            return "anchor does not match lyric text"
    return None


def backup_song(song_path: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_dir = ROOT / "data" / "backups" / "songs"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{song_path.stem}.{timestamp}.json"
    shutil.copy2(song_path, backup_path)
    return backup_path


def review(index: int, reason: str, line: dict[str, Any] | None, chant_text: Any, entry: Any) -> dict[str, Any]:
    return {
        "status": "needsReview",
        "reason": reason,
        "guideLineIndex": index,
        "lineId": line.get("id") if line else None,
        "lyricText": line.get("text") if line else None,
        "chantText": chant_text,
        "guideEntry": entry,
    }


def normalize_text(value: Any) -> str:
    return " ".join(str(value).strip().casefold().split())


def require_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} is required")
    return value


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
