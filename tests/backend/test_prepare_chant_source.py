from __future__ import annotations

from scripts.prepare_chant_source import build_guide, parse_source_line


def test_parse_source_line_marks_bold_and_parentheses() -> None:
    parsed = parse_source_line("꽃은 **피고** (피고)")

    assert parsed["plainText"] == "꽃은 피고"
    assert parsed["notes"] == [
        {
            "type": "chant",
            "mode": "inline",
            "label": "sing-along",
            "text": "피고",
            "placement": "inline",
            "anchor": {"matchText": "피고", "occurrence": 1, "charStart": 3, "charEnd": 5},
        },
        {
            "type": "chant",
            "mode": "standalone",
            "label": "chant",
            "text": "피고",
            "placement": "insert-at",
            "anchor": {"matchText": "", "occurrence": 0, "charStart": 6, "charEnd": 6},
        },
    ]


def test_build_guide_anchors_to_timed_lyrics() -> None:
    payload = {
        "title": "4 Flowers",
        "artist": "MAMAMOO",
        "lyrics": [
            {"id": "l1", "text": "꽃은 피고"},
            {"id": "l2", "text": "웅크린 후에야 Breathe again e e (고개를 들어)"},
        ],
    }

    guide = build_guide("song_test", payload, "꽃은 **피고** (피고)\n웅크린 후에야 Breathe again e e (고개를 들어)")

    assert guide["guideLines"][0]["lineId"] == "l1"
    assert guide["guideLines"][0]["notes"][1]["anchor"] == {"matchText": "", "occurrence": 0, "charStart": 5, "charEnd": 5}
    assert guide["guideLines"][1]["lineId"] == "l2"
    assert guide["guideLines"][1]["notes"] == [
        {
            "type": "chant",
            "mode": "inline",
            "label": "sing-along",
            "text": "고개를 들어",
            "placement": "inline",
            "anchor": {"matchText": "고개를 들어", "occurrence": 1, "charStart": 27, "charEnd": 33},
        }
    ]


def test_parse_source_line_marks_replacement() -> None:
    parsed = parse_source_line("Throw away the suit and ~~tie~~(suit and tie)")

    assert parsed["plainText"] == "Throw away the suit and tie"
    assert parsed["notes"] == [
        {
            "type": "chant",
            "mode": "standalone",
            "label": "chant",
            "text": "suit and tie",
            "placement": "replace-phrase",
            "anchor": {"matchText": "tie", "occurrence": 1, "charStart": 24, "charEnd": 27},
        }
    ]
