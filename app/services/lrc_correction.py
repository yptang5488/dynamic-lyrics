from __future__ import annotations

from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
import re

from app.config import settings


WHITESPACE_PATTERN = re.compile(r"\s+")
PUNCT_PATTERN = re.compile(r"[\.,!?:;\-\(\)\[\]\{\}\"']")


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class CorrectionAnchor:
    lyric_id: str
    lyric_text: str
    lyric_start: float
    transcript_text: str
    transcript_start: float
    score: float


@dataclass(frozen=True)
class LrcCorrectionResult:
    lyrics: list[dict[str, object]]
    applied: bool
    offset_seconds: float | None
    anchor_count: int
    method: str
    warnings: list[str]
    anchors: list[CorrectionAnchor]

    def to_metadata(self) -> dict[str, object]:
        return {
            "applied": self.applied,
            "offsetSeconds": self.offset_seconds,
            "anchorCount": self.anchor_count,
            "method": self.method,
            "warnings": self.warnings,
            "anchors": [asdict(anchor) for anchor in self.anchors],
        }


def correct_lrc_lyrics(
    lyrics: list[dict[str, object]], *, audio_path: str | None, language: str
) -> LrcCorrectionResult:
    if settings.lrc_correction_mode != "whisperx_global":
        return LrcCorrectionResult(
            lyrics=lyrics,
            applied=False,
            offset_seconds=None,
            anchor_count=0,
            method="off",
            warnings=[],
            anchors=[],
        )

    if not audio_path:
        return LrcCorrectionResult(
            lyrics=lyrics,
            applied=False,
            offset_seconds=None,
            anchor_count=0,
            method="whisperx_global",
            warnings=[
                "offset correction skipped because normalized audio path was unavailable"
            ],
            anchors=[],
        )

    try:
        transcript_segments = transcribe_with_whisperx(Path(audio_path), language)
    except Exception as exc:  # noqa: BLE001
        return LrcCorrectionResult(
            lyrics=lyrics,
            applied=False,
            offset_seconds=None,
            anchor_count=0,
            method="whisperx_global",
            warnings=[f"offset correction skipped because WhisperX failed: {exc}"],
            anchors=[],
        )

    anchors = match_lyric_anchors(lyrics, transcript_segments)
    offset = estimate_global_offset(anchors)
    warnings: list[str] = []

    if len(anchors) < settings.lrc_min_anchor_count:
        warnings.append(
            "offset correction skipped because too few reliable anchors were found"
        )
    elif offset is None:
        warnings.append(
            "offset correction skipped because no stable offset could be estimated"
        )
    elif abs(offset) > settings.lrc_max_offset_seconds:
        warnings.append(
            "offset correction skipped because the estimated offset exceeded the safe threshold"
        )
    else:
        warnings.append(f"offset correction applied: {offset:+.3f}s")
        return LrcCorrectionResult(
            lyrics=shift_lyrics(lyrics, offset),
            applied=True,
            offset_seconds=round(offset, 3),
            anchor_count=len(anchors),
            method="whisperx_global",
            warnings=warnings,
            anchors=anchors,
        )

    return LrcCorrectionResult(
        lyrics=lyrics,
        applied=False,
        offset_seconds=round(offset, 3) if offset is not None else None,
        anchor_count=len(anchors),
        method="whisperx_global",
        warnings=warnings,
        anchors=anchors,
    )


def match_lyric_anchors(
    lyrics: list[dict[str, object]], transcript_segments: list[TranscriptSegment]
) -> list[CorrectionAnchor]:
    anchors: list[CorrectionAnchor] = []
    segment_index = 0

    for lyric in lyrics:
        lyric_text = str(lyric.get("text") or "")
        normalized_lyric = normalize_match_text(lyric_text)
        if not normalized_lyric:
            continue

        best_match: CorrectionAnchor | None = None
        for index in range(segment_index, len(transcript_segments)):
            segment = transcript_segments[index]
            score = text_similarity(
                normalized_lyric, normalize_match_text(segment.text)
            )
            if score < 0.55:
                continue

            candidate = CorrectionAnchor(
                lyric_id=str(lyric.get("id") or ""),
                lyric_text=lyric_text,
                lyric_start=float(lyric.get("start") or 0.0),
                transcript_text=segment.text,
                transcript_start=segment.start,
                score=score,
            )
            if best_match is None or candidate.score > best_match.score:
                best_match = candidate

            if score >= 0.92:
                segment_index = index + 1
                break

        if best_match is not None:
            anchors.append(best_match)
            next_segment_start = next(
                (
                    idx + 1
                    for idx in range(segment_index, len(transcript_segments))
                    if transcript_segments[idx].start == best_match.transcript_start
                    and transcript_segments[idx].text == best_match.transcript_text
                ),
                None,
            )
            if next_segment_start is not None:
                segment_index = next_segment_start

    return anchors


def estimate_global_offset(anchors: list[CorrectionAnchor]) -> float | None:
    if not anchors:
        return None

    deltas = sorted(anchor.transcript_start - anchor.lyric_start for anchor in anchors)
    middle = len(deltas) // 2
    if len(deltas) % 2 == 1:
        return deltas[middle]
    return (deltas[middle - 1] + deltas[middle]) / 2


def shift_lyrics(
    lyrics: list[dict[str, object]], offset_seconds: float
) -> list[dict[str, object]]:
    shifted: list[dict[str, object]] = []
    previous_end = 0.0

    for lyric in lyrics:
        start = max(0.0, round(float(lyric.get("start") or 0.0) + offset_seconds, 3))
        end = max(
            start + 0.001, round(float(lyric.get("end") or 0.0) + offset_seconds, 3)
        )
        start = max(start, previous_end)
        end = max(end, start + 0.001)
        previous_end = end
        shifted.append({**lyric, "start": start, "end": end})

    return shifted


def normalize_match_text(text: str) -> str:
    lowered = text.casefold().strip()
    lowered = PUNCT_PATTERN.sub(" ", lowered)
    lowered = WHITESPACE_PATTERN.sub(" ", lowered)
    return lowered.strip()


def text_similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def transcribe_with_whisperx(
    audio_path: Path, language: str
) -> list[TranscriptSegment]:
    try:
        import whisperx  # type: ignore
    except ImportError as exc:  # pragma: no cover - depends on optional install
        raise RuntimeError("WhisperX is not installed in this environment") from exc

    device = "cpu"
    model = whisperx.load_model("small", device, language=language, compute_type="int8")
    audio = whisperx.load_audio(str(audio_path))
    result = model.transcribe(audio, language=language)

    segments: list[TranscriptSegment] = []
    for segment in result.get("segments", []):
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        start = float(segment.get("start") or 0.0)
        end = float(segment.get("end") or start)
        segments.append(TranscriptSegment(start=start, end=end, text=text))
    return segments
