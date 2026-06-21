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


ROOT = Path(__file__).resolve().parents[1]
TIME_FIELDS = ("start", "end")


def main() -> None:
    parser = argparse.ArgumentParser(description="Shift lyric timing from one line onward.")
    parser.add_argument("song", type=Path, help="Path to data/songs/{songId}.json")
    parser.add_argument("--from-line", required=True, help="Line id where shifting starts, for example l45.")
    parser.add_argument("--offset", required=True, type=float, help="Seconds to shift. Use negative values to move earlier.")
    parser.add_argument("--apply", action="store_true", help="Write the shifted payload. Without this, only prints a report.")
    parser.add_argument("--report", type=Path, help="Write the report JSON to this path.")
    parser.add_argument("--verbose", action="store_true", help="Include every shifted line in stdout.")
    args = parser.parse_args()

    song_record = read_json(args.song)
    payload = json_loads(song_record.get("lyrics_json"), {})
    result = shift_payload(payload, args.from_line, args.offset)

    if args.apply:
        backup_path = backup_song(args.song)
        song_record["lyrics_json"] = json_dumps(payload)
        song_record["updated_at"] = datetime.now(timezone.utc).isoformat()
        write_json(args.song, song_record)
        result["backupPath"] = str(backup_path)

    stdout_result = result if args.verbose else {key: value for key, value in result.items() if key != "shiftedLines"}
    report = json.dumps(stdout_result, indent=2, ensure_ascii=False)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(report)


def shift_payload(payload: dict[str, Any], from_line_id: str, offset: float) -> dict[str, Any]:
    lyrics = payload.get("lyrics")
    if not isinstance(lyrics, list):
        raise ValueError("song payload lyrics must be a list")

    start_index = next((index for index, line in enumerate(lyrics) if isinstance(line, dict) and line.get("id") == from_line_id), None)
    if start_index is None:
        raise ValueError(f"unknown line id: {from_line_id}")

    shifted: list[dict[str, Any]] = []
    validate_shifted_times(lyrics[start_index:], offset)
    for line in lyrics[start_index:]:
        if not isinstance(line, dict):
            continue
        before = snapshot_line(line)
        shift_line(line, offset)
        shifted.append({"lineId": line.get("id"), "before": before, "after": snapshot_line(line)})

    return {
        "status": "ok",
        "fromLine": from_line_id,
        "offset": offset,
        "linesShifted": len(shifted),
        "shiftedLines": shifted,
    }


def validate_shifted_times(lines: list[Any], offset: float) -> None:
    for line in lines:
        if not isinstance(line, dict):
            continue
        segments = line.get("segments", [])
        if not isinstance(segments, list):
            segments = []
        for payload in [line, *segments]:
            if not isinstance(payload, dict):
                continue
            for field in TIME_FIELDS:
                value = payload.get(field)
                if isinstance(value, (int, float)) and round(value + offset, 3) < 0:
                    raise ValueError("timing shift would create a negative timestamp")


def shift_line(line: dict[str, Any], offset: float) -> None:
    shift_time_fields(line, offset)
    segments = line.get("segments")
    if isinstance(segments, list):
        for segment in segments:
            if isinstance(segment, dict):
                shift_time_fields(segment, offset)


def shift_time_fields(payload: dict[str, Any], offset: float) -> None:
    for field in TIME_FIELDS:
        value = payload.get(field)
        if isinstance(value, (int, float)):
            payload[field] = round(value + offset, 3)


def snapshot_line(line: dict[str, Any]) -> dict[str, Any]:
    return {field: line.get(field) for field in TIME_FIELDS if field in line}


def backup_song(song_path: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_dir = ROOT / "data" / "backups" / "songs"
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"{song_path.stem}.{timestamp}.json"
    shutil.copy2(song_path, backup_path)
    return backup_path


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
