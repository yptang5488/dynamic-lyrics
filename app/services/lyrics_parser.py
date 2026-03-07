from __future__ import annotations


def parse_lyrics(
    lyrics_text: str, translations: list[str] | None = None
) -> list[dict[str, str | None]]:
    lines = [line.strip() for line in lyrics_text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("No lyric lines found")

    normalized_translations = [item.strip() for item in (translations or [])]
    if normalized_translations and len(normalized_translations) != len(lines):
        raise ValueError("translations count must match non-empty lyric line count")

    parsed: list[dict[str, str | None]] = []
    for index, line in enumerate(lines):
        translation = (
            normalized_translations[index] if normalized_translations else None
        )
        parsed.append({"text": line, "translation": translation or None})
    return parsed
