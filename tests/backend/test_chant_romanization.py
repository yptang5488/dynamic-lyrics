from __future__ import annotations

from app.services.chant_romanization import normalize_chant_notes, romanize_text


def test_romanize_text_handles_korean_english_and_liaison() -> None:
    assert romanize_text("김용선") == "gimyongseon"
    assert romanize_text("drop drop drop") == ""
    assert romanize_text("click click 삑") == "click click ppik"
    assert romanize_text("한국어") == "hangugeo"
    assert romanize_text("먹어요") == "meogeoyo"
    assert romanize_text("읽어요") == "ilgeoyo"
    assert romanize_text("앉아") == "anja"
    assert romanize_text("값을") == "gapsseul"


def test_normalize_chant_notes_adds_and_removes_romanized_text() -> None:
    notes = [
        {"type": "chant", "text": "김용선"},
        {"type": "chant", "text": "drop drop drop", "romanizedText": "stale"},
        {"type": "meaning", "text": "김용선"},
    ]

    assert normalize_chant_notes(notes) == [
        {"type": "chant", "text": "김용선", "romanizedText": "gimyongseon"},
        {"type": "chant", "text": "drop drop drop"},
        {"type": "meaning", "text": "김용선"},
    ]
