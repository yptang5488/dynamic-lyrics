from __future__ import annotations

import pytest

from app.services.lyrics_parser import parse_lyrics


def test_parse_lyrics_strips_blank_lines_and_maps_translations() -> None:
    parsed = parse_lyrics(
        "\n First line \n\nSecond line\n",
        [" Translation one ", "Translation two"],
    )

    assert parsed == [
        {"text": "First line", "translation": "Translation one"},
        {"text": "Second line", "translation": "Translation two"},
    ]


def test_parse_lyrics_rejects_translation_count_mismatch() -> None:
    with pytest.raises(ValueError, match="translations count must match"):
        parse_lyrics("First line\nSecond line", ["Only one translation"])


def test_parse_lyrics_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="No lyric lines found"):
        parse_lyrics("\n \n")
