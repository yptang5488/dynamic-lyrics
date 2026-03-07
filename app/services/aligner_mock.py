from __future__ import annotations

from app.services.aligner_base import Aligner


class MockAligner(Aligner):
    def align(
        self,
        duration: float | None,
        lyric_lines: list[dict[str, str | None]],
        language: str,
    ) -> list[dict[str, object]]:
        total_duration = duration or max(10.0, len(lyric_lines) * 4.0)
        slot = total_duration / len(lyric_lines)
        aligned: list[dict[str, object]] = []

        for index, line in enumerate(lyric_lines, start=1):
            start = round((index - 1) * slot, 2)
            end = round(min(total_duration, index * slot - 0.15), 2)
            confidence = round(min(0.6, 0.35 + index * 0.03), 2)
            aligned.append(
                {
                    "id": f"l{index}",
                    "start": start,
                    "end": max(start + 0.5, end),
                    "text": line["text"],
                    "translation": line["translation"],
                    "confidence": confidence,
                    "segments": [],
                    "notes": [],
                    "language": language,
                }
            )
        return aligned
