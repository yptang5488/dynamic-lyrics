from __future__ import annotations

from app.config import Settings
from app.services.lrc_correction import (
    TranscriptSegment,
    correct_lrc_lyrics,
    estimate_global_offset,
    match_lyric_anchors,
    shift_lyrics,
)


def test_estimate_global_offset_uses_median_anchor_delta() -> None:
    anchors = match_lyric_anchors(
        [
            {"id": "l1", "text": "hello world", "start": 10.0},
            {"id": "l2", "text": "second line", "start": 20.0},
            {"id": "l3", "text": "third line", "start": 30.0},
        ],
        [
            TranscriptSegment(start=11.2, end=12.0, text="hello world"),
            TranscriptSegment(start=21.1, end=22.0, text="second line"),
            TranscriptSegment(start=31.3, end=32.0, text="third line"),
        ],
    )

    assert round(estimate_global_offset(anchors) or 0.0, 3) == 1.2


def test_shift_lyrics_applies_offset_and_preserves_monotonic_order() -> None:
    shifted = shift_lyrics(
        [
            {"id": "l1", "start": 2.0, "end": 4.0, "text": "a"},
            {"id": "l2", "start": 4.0, "end": 5.0, "text": "b"},
        ],
        -1.5,
    )

    assert shifted[0]["start"] == 0.5
    assert shifted[0]["end"] == 2.5
    assert shifted[1]["start"] >= shifted[0]["end"]


def test_correct_lrc_lyrics_applies_global_offset_when_whisperx_anchors_are_stable(
    monkeypatch,
) -> None:
    import app.services.lrc_correction as correction_module

    monkeypatch.setattr(
        correction_module,
        "settings",
        Settings(lrc_correction_mode="whisperx_global", lrc_min_anchor_count=3),
    )
    monkeypatch.setattr(
        correction_module,
        "transcribe_with_whisperx",
        lambda audio_path, language: [
            TranscriptSegment(start=11.0, end=12.0, text="hello world"),
            TranscriptSegment(start=21.0, end=22.0, text="second line"),
            TranscriptSegment(start=31.0, end=32.0, text="third line"),
        ],
    )

    result = correct_lrc_lyrics(
        [
            {
                "id": "l1",
                "start": 10.0,
                "end": 12.0,
                "text": "hello world",
                "translation": None,
            },
            {
                "id": "l2",
                "start": 20.0,
                "end": 22.0,
                "text": "second line",
                "translation": None,
            },
            {
                "id": "l3",
                "start": 30.0,
                "end": 32.0,
                "text": "third line",
                "translation": None,
            },
        ],
        audio_path="/tmp/fake.mp3",
        language="en",
    )

    assert result.applied is True
    assert result.offset_seconds == 1.0
    assert result.anchor_count == 3
    assert result.lyrics[0]["start"] == 11.0
    assert result.warnings == ["offset correction applied: +1.000s"]


def test_correct_lrc_lyrics_skips_when_too_few_anchors(monkeypatch) -> None:
    import app.services.lrc_correction as correction_module

    monkeypatch.setattr(
        correction_module,
        "settings",
        Settings(lrc_correction_mode="whisperx_global", lrc_min_anchor_count=3),
    )
    monkeypatch.setattr(
        correction_module,
        "transcribe_with_whisperx",
        lambda audio_path, language: [
            TranscriptSegment(start=11.0, end=12.0, text="hello world")
        ],
    )

    result = correct_lrc_lyrics(
        [
            {
                "id": "l1",
                "start": 10.0,
                "end": 12.0,
                "text": "hello world",
                "translation": None,
            }
        ],
        audio_path="/tmp/fake.mp3",
        language="en",
    )

    assert result.applied is False
    assert result.anchor_count == 1
    assert result.warnings == [
        "offset correction skipped because too few reliable anchors were found"
    ]


def test_correct_lrc_lyrics_skips_when_offset_is_unsafe(monkeypatch) -> None:
    import app.services.lrc_correction as correction_module

    monkeypatch.setattr(
        correction_module,
        "settings",
        Settings(
            lrc_correction_mode="whisperx_global",
            lrc_min_anchor_count=3,
            lrc_max_offset_seconds=2.0,
        ),
    )
    monkeypatch.setattr(
        correction_module,
        "transcribe_with_whisperx",
        lambda audio_path, language: [
            TranscriptSegment(start=15.0, end=16.0, text="hello world"),
            TranscriptSegment(start=25.0, end=26.0, text="second line"),
            TranscriptSegment(start=35.0, end=36.0, text="third line"),
        ],
    )

    result = correct_lrc_lyrics(
        [
            {
                "id": "l1",
                "start": 10.0,
                "end": 12.0,
                "text": "hello world",
                "translation": None,
            },
            {
                "id": "l2",
                "start": 20.0,
                "end": 22.0,
                "text": "second line",
                "translation": None,
            },
            {
                "id": "l3",
                "start": 30.0,
                "end": 32.0,
                "text": "third line",
                "translation": None,
            },
        ],
        audio_path="/tmp/fake.mp3",
        language="en",
    )

    assert result.applied is False
    assert result.offset_seconds == 5.0
    assert result.warnings == [
        "offset correction skipped because the estimated offset exceeded the safe threshold"
    ]
