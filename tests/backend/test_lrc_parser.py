from __future__ import annotations

from app.services.lrc_parser import build_paired_lrc_lyrics, parse_lrc


def test_parse_lrc_collects_timestamped_entries_and_metadata() -> None:
    parsed = parse_lrc(
        "[ti:Sample Song]\n[ar:Sample Artist]\n[00:08.000]First line\n[00:10.000]Translation"
    )

    assert parsed.metadata == {"ti": "Sample Song", "ar": "Sample Artist"}
    assert len(parsed.entries) == 2
    assert parsed.entries[0].timestamp == 8.0
    assert parsed.entries[0].text == "First line"
    assert parsed.entries[1].timestamp == 10.0


def test_build_paired_lrc_lyrics_ignores_credits_and_pairs_translation() -> None:
    lyrics, metadata, warnings = build_paired_lrc_lyrics(
        "\n".join(
            [
                "[00:00.000]LRC-toomic.com",
                "[00:00.000]Sample Song - Sample Artist",
                "[00:08.000]이미 알아차렸겠지",
                "[00:10.000]应该早就已经察觉",
                "[00:10.000]그치 언니",
                "[00:11.000]对吧姐姐",
            ]
        ),
        duration=123.4,
    )

    assert metadata == {}
    assert warnings == []
    assert lyrics == [
        {
            "id": "l1",
            "start": 8.0,
            "end": 10.0,
            "text": "이미 알아차렸겠지",
            "translation": "应该早就已经察觉",
            "confidence": 0.98,
            "segments": [],
            "notes": [],
        },
        {
            "id": "l2",
            "start": 10.0,
            "end": 11.0,
            "text": "그치 언니",
            "translation": "对吧姐姐",
            "confidence": 0.98,
            "segments": [],
            "notes": [],
        },
    ]


def test_build_paired_lrc_lyrics_handles_missing_translation_with_fallback() -> None:
    lyrics, _, warnings = build_paired_lrc_lyrics(
        "[00:08.000]First line\n[00:10.000]Second line\n",
        duration=15.0,
    )

    assert lyrics[0]["start"] == 8.0
    assert lyrics[0]["end"] == 10.0
    assert lyrics[0]["translation"] is None
    assert lyrics[1]["end"] == 15.0
    assert warnings == []


def test_build_paired_lrc_lyrics_matches_bang_bang_sample_rules() -> None:
    lrc_text = "\n".join(
        [
            "[00:00.000]LRC-toomic.com",
            "[00:00.000]BANG BANG - IVE (아이브)",
            "[00:06.000]It's a new scene It's aggressive",
            "[00:08.000]이미 알아차렸겠지",
            "[00:10.000]应该早就已经察觉",
            "[00:10.000]그치 언니",
            "[00:11.000]对吧姐姐",
        ]
    )

    lyrics, _, warnings = build_paired_lrc_lyrics(lrc_text, duration=172.0)

    assert warnings == []
    assert lyrics[0]["text"] == "It's a new scene It's aggressive"
    assert lyrics[0]["translation"] is None
    assert lyrics[0]["start"] == 6.0
    assert lyrics[0]["end"] == 8.0
    assert lyrics[1]["text"] == "이미 알아차렸겠지"
    assert lyrics[1]["translation"] == "应该早就已经察觉"
    assert lyrics[1]["start"] == 8.0
    assert lyrics[1]["end"] == 10.0
