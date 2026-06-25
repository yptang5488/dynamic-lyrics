from __future__ import annotations

from app.services.chant_romanization import normalize_chant_events, normalize_chant_notes, romanize_text


def test_romanize_text_handles_korean_english_and_liaison() -> None:
    assert romanize_text("김용선") == "金容仙"
    assert romanize_text("김용선金容仙 문별이文星伊 정휘인丁輝人 안혜진安惠真 마마무") == "金容仙 文星伊 丁輝人 安惠真 Mamamoo"
    assert romanize_text("화이팅", {"화이팅": "hwaiting"}) == "hwaiting"
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
        {"type": "chant", "text": "김용선", "romanizedText": "金容仙"},
        {"type": "chant", "text": "drop drop drop"},
        {"type": "meaning", "text": "김용선"},
    ]


def test_normalize_chant_events_adds_and_removes_romanized_text() -> None:
    events = [
        {"id": "c1", "start": 0, "end": 1, "text": "마마무"},
        {"id": "c2", "start": 1, "end": 2, "text": "SCREAM", "romanizedText": "stale"},
    ]

    assert normalize_chant_events(events) == [
        {"id": "c1", "start": 0, "end": 1, "text": "마마무", "romanizedText": "Mamamoo"},
        {"id": "c2", "start": 1, "end": 2, "text": "SCREAM"},
    ]
