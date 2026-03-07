from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from app.config import settings


def normalize_audio(source_id: str, original_path: Path) -> Path:
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path is None:
        normalized_path = settings.normalized_dir / f"{source_id}{original_path.suffix}"
        shutil.copyfile(original_path, normalized_path)
        return normalized_path

    normalized_path = settings.normalized_dir / f"{source_id}.wav"

    command = [
        ffmpeg_path,
        "-y",
        "-i",
        str(original_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(normalized_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "ffmpeg normalization failed")
    return normalized_path


def probe_duration(path: Path) -> float | None:
    ffprobe_path = shutil.which("ffprobe")
    if ffprobe_path is None:
        return None
    command = [
        ffprobe_path,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        return None
    try:
        return float(completed.stdout.strip())
    except ValueError:
        return None
