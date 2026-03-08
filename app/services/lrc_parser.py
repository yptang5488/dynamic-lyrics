from __future__ import annotations

import re
from dataclasses import dataclass


TIMESTAMP_PATTERN = re.compile(r"\[(\d{2}):(\d{2})(?:[.:](\d{1,3}))?\]")
METADATA_PATTERN = re.compile(r"^\[(ar|ti|al|by|offset):(.+)\]$", re.IGNORECASE)
CREDIT_MARKERS = (
    "lrc-toomic.com",
    "词：",
    "曲：",
    "编曲：",
    "original lyrics by",
    "vocal directed by",
    "background vocals by",
    "programming by",
    "recorded by",
    "digital edited by",
    "mixed by",
    "mastered by",
    "original title：",
    "original writer：",
    "original publisher：",
    "sub publisher：",
)


@dataclass(frozen=True)
class LrcEntry:
    timestamp: float
    text: str
    line_number: int
    raw_text: str


@dataclass(frozen=True)
class ParsedLrc:
    metadata: dict[str, str]
    entries: list[LrcEntry]


def parse_lrc(text: str) -> ParsedLrc:
    metadata: dict[str, str] = {}
    entries: list[LrcEntry] = []

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        metadata_match = METADATA_PATTERN.match(raw_line.strip())
        if metadata_match:
            metadata[metadata_match.group(1).lower()] = metadata_match.group(2).strip()
            continue

        matches = list(TIMESTAMP_PATTERN.finditer(raw_line))
        if not matches:
            continue

        text_start = matches[-1].end()
        content = raw_line[text_start:].strip()
        for match in matches:
            entries.append(
                LrcEntry(
                    timestamp=_timestamp_to_seconds(match),
                    text=content,
                    line_number=line_number,
                    raw_text=raw_line,
                )
            )

    return ParsedLrc(metadata=metadata, entries=entries)


def build_paired_lrc_lyrics(
    lrc_text: str, *, duration: float | None
) -> tuple[list[dict[str, object]], dict[str, str], list[str]]:
    parsed = parse_lrc(lrc_text)
    warnings: list[str] = []
    lyrics: list[dict[str, object]] = []

    current_original: LrcEntry | None = None
    current_translation_parts: list[str] = []
    current_end: float | None = None
    line_index = 1

    def flush(next_start: float | None = None) -> None:
        nonlocal current_original, current_translation_parts, current_end, line_index
        if current_original is None:
            return

        end = current_end
        if end is None:
            end = (
                next_start
                if next_start is not None and next_start > current_original.timestamp
                else duration
            )
        if end is None or end <= current_original.timestamp:
            end = round(current_original.timestamp + 2.0, 3)
            warnings.append(
                f"line {current_original.line_number} used fallback end timestamp"
            )

        lyrics.append(
            {
                "id": f"l{line_index}",
                "start": round(current_original.timestamp, 3),
                "end": round(end, 3),
                "text": current_original.text,
                "translation": "\n".join(current_translation_parts) or None,
                "confidence": 0.98 if current_translation_parts else 0.9,
                "segments": [],
                "notes": [],
            }
        )
        line_index += 1
        current_original = None
        current_translation_parts = []
        current_end = None

    for entry in parsed.entries:
        line_type = classify_lrc_entry(entry, parsed.metadata)
        if line_type in {"credit", "empty"}:
            continue
        if line_type == "translation":
            if current_original is None:
                warnings.append(
                    f"line {entry.line_number} translation ignored without preceding original"
                )
                continue
            current_translation_parts.append(entry.text)
            current_end = entry.timestamp
            continue

        if current_original is not None:
            flush(next_start=entry.timestamp)
        current_original = entry

    flush()
    return lyrics, parsed.metadata, warnings


def classify_lrc_entry(entry: LrcEntry, metadata: dict[str, str] | None = None) -> str:
    text = entry.text.strip()
    if not text:
        return "empty"

    lowered = text.lower()
    if any(marker in lowered for marker in CREDIT_MARKERS):
        return "credit"
    if _looks_like_title_banner(text, entry.timestamp, metadata or {}):
        return "credit"
    if _contains_hangul(text):
        return "original"
    if _contains_cjk(text):
        return "translation"
    return "original"


def _timestamp_to_seconds(match: re.Match[str]) -> float:
    minutes = int(match.group(1))
    seconds = int(match.group(2))
    fraction = match.group(3) or "0"
    milliseconds = int(fraction.ljust(3, "0")[:3])
    return minutes * 60 + seconds + milliseconds / 1000


def _contains_hangul(text: str) -> bool:
    return any("\uac00" <= char <= "\ud7a3" for char in text)


def _contains_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text)


def _looks_like_title_banner(
    text: str, timestamp: float, metadata: dict[str, str]
) -> bool:
    if timestamp > 2.0 or metadata.get("ti") or metadata.get("ar"):
        return False
    return " - " in text
