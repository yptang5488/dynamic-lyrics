from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.chant_romanization import has_hangul, romanize_text  # noqa: E402


TIMESTAMP_RE = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate an LRC containing romanized Korean chant notes from a song/player JSON. "
            "For a plain LRC input, romanizes every timed line."
        )
    )
    parser.add_argument("input", nargs="?", type=Path, help="Song JSON, player JSON, or chant-only LRC input.")
    parser.add_argument("--output", "-o", type=Path, help="Output .lrc path. Defaults to INPUT.romanized.lrc.")
    parser.add_argument("--overrides", type=Path, help="Optional JSON object of Korean text to fixed romanization.")
    parser.add_argument("--check", action="store_true", help="Run a small romanization self-check and exit.")
    args = parser.parse_args()

    if args.check:
        run_check()
        return
    if args.input is None:
        raise SystemExit("input is required unless --check is passed")

    overrides = load_overrides(args.overrides)
    output = args.output or args.input.with_suffix(".romanized.lrc")
    lrc = convert_input(args.input.read_text(encoding="utf-8"), overrides)
    output.write_text(lrc, encoding="utf-8")
    print(f"Wrote {output}")


def convert_input(text: str, overrides: dict[str, str]) -> str:
    stripped = text.lstrip()
    if stripped.startswith("{"):
        return convert_json(json.loads(text), overrides)
    return convert_plain_lrc(text, overrides)


def convert_json(payload: dict[str, Any], overrides: dict[str, str]) -> str:
    player_payload = json.loads(payload["lyrics_json"]) if isinstance(payload.get("lyrics_json"), str) else payload
    lines = []
    for line in player_payload.get("lyrics", []):
        chants = [note for note in line.get("notes", []) if is_korean_chant_note(note)]
        romanized = [romanize_text(str(note.get("text", "")), overrides) for note in chants]
        romanized = [item for item in romanized if item]
        if romanized:
            lines.append(f"{format_timestamp(float(line['start']))}{' / '.join(romanized)}")
    return "\n".join(lines) + ("\n" if lines else "")


def convert_plain_lrc(text: str, overrides: dict[str, str]) -> str:
    lines = []
    for line in text.splitlines():
        matches = list(TIMESTAMP_RE.finditer(line))
        if not matches:
            continue
        body = line[matches[-1].end() :].strip()
        romanized = romanize_text(body, overrides)
        if romanized:
            lines.append(f"{''.join(match.group(0) for match in matches)}{romanized}")
    return "\n".join(lines) + ("\n" if lines else "")


def is_korean_chant_note(note: Any) -> bool:
    return isinstance(note, dict) and note.get("type") == "chant" and isinstance(note.get("text"), str) and has_hangul(note["text"])


def format_timestamp(seconds: float) -> str:
    minutes = int(seconds // 60)
    remaining = seconds - minutes * 60
    return f"[{minutes:02d}:{remaining:05.2f}]"


def load_overrides(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in payload.items()):
        raise SystemExit("--overrides must point to a JSON object of string keys and string values")
    return payload


def run_check() -> None:
    assert romanize_text("김용선") == "gimyongseon"
    assert romanize_text("화이팅", {"화이팅": "hwaiting"}) == "hwaiting"
    assert romanize_text("drop drop drop") == ""
    assert romanize_text("click click 삑") == "click click ppik"
    assert romanize_text("한국어") == "hangugeo"
    assert romanize_text("먹어요") == "meogeoyo"
    assert romanize_text("읽어요") == "ilgeoyo"
    assert romanize_text("앉아") == "anja"
    assert romanize_text("값을") == "gapsseul"
    sample = {"lyrics": [{"start": 3.02, "notes": [{"type": "chant", "text": "김용선"}, {"type": "chant", "text": "drop drop drop"}]}]}
    assert convert_json(sample, {}) == "[00:03.02]gimyongseon\n"
    print("romanize_chant_lrc check passed")


if __name__ == "__main__":
    main()
