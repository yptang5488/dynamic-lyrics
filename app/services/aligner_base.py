from __future__ import annotations

from abc import ABC, abstractmethod


class Aligner(ABC):
    @abstractmethod
    def align(
        self,
        duration: float | None,
        lyric_lines: list[dict[str, str | None]],
        language: str,
    ) -> list[dict[str, object]]:
        raise NotImplementedError
