from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import json_loads  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
REPLACE_RE = re.compile(r"~~(.+?)~~\((.+?)\)")
PAREN_RE = re.compile(r"\(([^()]+)\)")
SOURCE_MARK_RE = re.compile(r"\s*\[[\d,\s]+\]\s*$")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a marked chant source markdown file into chant-guide.v1 JSON.")
    parser.add_argument("source", type=Path, help="Markdown/text source using bold, parentheses, and strikethrough chant notation.")
    parser.add_argument("--song-id", required=True, help="Target song id under data/songs.")
    parser.add_argument("--output", type=Path, help="Guide output path. Defaults to data/chant-guides/{songId}.json.")
    parser.add_argument("--dry-run", action="store_true", help="Run import_chant_guide.py after writing the guide.")
    parser.add_argument("--apply", action="store_true", help="Run import_chant_guide.py --apply after writing the guide.")
    parser.add_argument("--report", type=Path, help="Optional import report path when --dry-run or --apply is used.")
    args = parser.parse_args()

    song_path = ROOT / "data" / "songs" / f"{args.song_id}.json"
    song_record = read_json(song_path)
    song_payload = json_loads(song_record.get("lyrics_json"), {})
    output = args.output or ROOT / "data" / "chant-guides" / f"{args.song_id}.json"
    guide = build_guide(args.song_id, song_payload, args.source.read_text(encoding="utf-8"))
    write_json(output, guide)
    print(f"Wrote {output}")

    if args.dry_run or args.apply:
        command = [sys.executable, str(ROOT / "scripts" / "import_chant_guide.py"), str(output)]
        if args.apply:
            command.append("--apply")
        if args.report:
            command.extend(["--report", str(args.report)])
        subprocess.run(command, check=True)


def build_guide(song_id: str, song_payload: dict[str, Any], source_text: str) -> dict[str, Any]:
    guide_lines = []
    lyric_order = song_payload.get("lyrics", [])
    search_start = 0
    for raw_line in source_text.splitlines():
        parsed = parse_source_line(raw_line)
        if not parsed["notes"]:
            continue
        match_index = match_source_line(parsed["plainText"], lyric_order, search_start)
        entry = {"lineMatchText": parsed["plainText"], "notes": parsed["notes"]}
        if match_index is not None:
            line = lyric_order[match_index]
            entry["lineId"] = line["id"]
            entry["lineMatchText"] = line["text"]
            entry["notes"] = reanchor_notes(parsed["notes"], parsed["plainText"], line["text"])
            search_start = match_index + 1
        guide_lines.append(entry)

    return {
        "schemaVersion": "chant-guide.v1",
        "songId": song_id,
        "song": {"title": song_payload.get("title"), "artist": song_payload.get("artist")},
        "source": {
            "formatNotes": [
                "**phrase** marks inline sing-along lyric text.",
                "(callout) after a lyric marks a standalone chant.",
                "~~lyric~~(chant) marks a replacement chant.",
            ]
        },
        "guideLines": guide_lines,
    }


def parse_source_line(raw_line: str) -> dict[str, Any]:
    line = SOURCE_MARK_RE.sub("", raw_line).strip()
    if not line or line.startswith("以上") or line.startswith("歌詞") or line.startswith("這是"):
        return {"plainText": "", "notes": []}

    notes: list[dict[str, Any]] = []
    plain = line
    for match in REPLACE_RE.finditer(line):
        start = plain_text_offset(line, match.start(1))
        end = start + len(match.group(1))
        notes.append({
            "type": "chant",
            "mode": "standalone",
            "label": "chant",
            "text": match.group(2),
            "placement": "replace-phrase",
            "anchor": {"matchText": match.group(1), "occurrence": 1, "charStart": start, "charEnd": end},
        })
    plain = REPLACE_RE.sub(lambda match: match.group(1), plain)

    for match in BOLD_RE.finditer(line):
        start = plain_text_offset(line, match.start(1))
        end = start + len(match.group(1))
        notes.append({
            "type": "chant",
            "mode": "inline",
            "label": "sing-along",
            "text": match.group(1),
            "placement": "inline",
            "anchor": {"matchText": match.group(1), "occurrence": 1, "charStart": start, "charEnd": end},
        })
    plain = BOLD_RE.sub(lambda match: match.group(1), plain)

    for match in PAREN_RE.finditer(plain):
        callout = match.group(1).strip()
        if not callout:
            continue
        char_start = match.start()
        notes.append({
            "type": "chant",
            "mode": "standalone",
            "label": "chant",
            "text": callout,
            "placement": "insert-at",
            "anchor": {"matchText": "", "occurrence": 0, "charStart": char_start, "charEnd": char_start},
        })
    plain = PAREN_RE.sub("", plain)
    plain = " ".join(plain.split())
    return {"plainText": plain, "notes": notes}


def reanchor_notes(notes: list[dict[str, Any]], source_text: str, lyric_text: str) -> list[dict[str, Any]]:
    adjusted = []
    for note in notes:
        next_note = dict(note)
        anchor = dict(note.get("anchor") or {})
        placement = note.get("placement")
        if placement in {"inline", "replace-phrase"}:
            match_text = anchor.get("matchText", "")
            start = lyric_text.find(match_text)
            if start >= 0:
                anchor["charStart"] = start
                anchor["charEnd"] = start + len(match_text)
        elif placement == "insert-at" and isinstance(note.get("text"), str) and f"({note['text']})" in lyric_text:
            start = lyric_text.find(note["text"])
            next_note["mode"] = "inline"
            next_note["label"] = "sing-along"
            next_note["placement"] = "inline"
            anchor["matchText"] = note["text"]
            anchor["occurrence"] = 1
            anchor["charStart"] = start
            anchor["charEnd"] = start + len(note["text"])
        elif placement == "insert-at":
            anchor["charStart"] = len(lyric_text)
            anchor["charEnd"] = len(lyric_text)
        next_note["anchor"] = anchor
        adjusted.append(next_note)
    return adjusted


def match_source_line(source_line: str, lyric_order: list[Any], start_index: int) -> int | None:
    if not source_line:
        return None
    normalized_source = normalize_text(source_line)
    for index in range(start_index, len(lyric_order)):
        line = lyric_order[index]
        if isinstance(line, dict) and normalize_text(line.get("text", "")) == normalized_source:
            return index
    for index, line in enumerate(lyric_order):
        if isinstance(line, dict) and normalize_text(line.get("text", "")) == normalized_source:
            return index
    return None


def plain_text_offset(marked_line: str, marked_index: int) -> int:
    prefix = marked_line[:marked_index]
    prefix = prefix.replace("**", "").replace("~~", "")
    return len(prefix)


def normalize_text(value: Any) -> str:
    text = str(value).replace("’", "'")
    text = PAREN_RE.sub("", text)
    return " ".join(text.strip().casefold().split())


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
