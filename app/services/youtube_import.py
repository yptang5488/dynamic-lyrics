from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from app.config import settings
from app.services.audio_normalize import normalize_audio, probe_duration


def sanitize_youtube_url(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host.endswith("youtu.be"):
        video_id = parsed.path.strip("/")
        if video_id:
            return f"https://www.youtube.com/watch?v={video_id}"
        return url

    if "youtube.com" not in host:
        return url

    query = parse_qs(parsed.query)
    video_id = query.get("v", [None])[0]
    if not video_id:
        return url

    cleaned_query = urlencode({"v": video_id})
    return urlunparse(("https", "www.youtube.com", "/watch", "", cleaned_query, ""))


def import_youtube_audio(source_id: str, url: str) -> dict[str, str | float | None]:
    ytdlp_path = shutil.which("yt-dlp")
    if ytdlp_path is None:
        raise RuntimeError("yt-dlp is required for YouTube imports")

    sanitized_url = sanitize_youtube_url(url)
    output_template = settings.raw_dir / f"{source_id}.%(ext)s"
    command = [
        ytdlp_path,
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--output",
        str(output_template),
        sanitized_url,
    ]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "yt-dlp import failed")

    candidates = sorted(settings.raw_dir.glob(f"{source_id}.*"))
    if not candidates:
        raise RuntimeError("No downloaded audio file found")

    original_path = _pick_audio_file(candidates)
    normalized_path = normalize_audio(source_id, original_path)
    duration = probe_duration(original_path)
    return {
        "original_path": str(original_path),
        "normalized_path": str(normalized_path),
        "duration": duration,
        "title": original_path.stem,
        "artist": None,
    }


def _pick_audio_file(candidates: list[Path]) -> Path:
    media_candidates = [
        path
        for path in candidates
        if path.suffix.lower() in {".mp3", ".m4a", ".wav", ".webm", ".opus"}
    ]
    if media_candidates:
        return media_candidates[0]
    return candidates[0]
