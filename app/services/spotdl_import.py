from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from app.config import settings


SPOTDL_AUDIO_PROVIDERS = ("youtube-music", "youtube", "piped")
SPOTDL_RETRY_WITHOUT_FILTER_MARKERS = (
    "filtered to 0 results",
    "no results found for song",
    "lookuperror: no results found",
)
SPOTDL_TRY_NEXT_PROVIDER_MARKERS = (
    "requested format is not available",
    "audioprovidererror: yt-dlp download error",
    "you are blocked by youtube music",
    *SPOTDL_RETRY_WITHOUT_FILTER_MARKERS,
)
TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class SpotdlImportResult:
    audio_path: Path
    lyrics_path: Path | None
    output_dir: Path


def import_spotify_audio(
    source_id: str,
    query: str,
    show_output: bool = False,
) -> SpotdlImportResult:
    output_dir = settings.raw_dir / f"{source_id}_spotdl"
    output_dir.mkdir(parents=True, exist_ok=True)

    last_output = ""
    auth_token = _get_spotify_auth_token()
    downloaded = False
    for provider in _get_spotdl_audio_providers():
        for disable_filter in _get_filter_attempt_order():
            if disable_filter and not _env_flag("SPOTDL_PREFER_DONT_FILTER") and not _should_retry_without_filter(last_output):
                continue

            command = _build_spotdl_command(
                query,
                output_dir,
                audio_provider=provider,
                auth_token=auth_token,
                disable_filter=disable_filter,
            )
            completed = _run_spotdl_command(command, show_output=show_output)
            last_output = _combined_output(completed)
            if completed.returncode == 0:
                if _has_audio_file(output_dir):
                    downloaded = True
                    break
                if not _should_try_next_provider(last_output):
                    last_output = last_output or f"spotdl finished but no audio file was found in {output_dir}"
                    break
            if not _should_try_next_provider(last_output):
                break
        if downloaded:
            break

    if not downloaded:
        raise RuntimeError(last_output.strip() or "spotdl import failed")

    audio_path = _pick_audio_file(output_dir)
    lyrics_path = _pick_lyrics_file(output_dir)
    return SpotdlImportResult(
        audio_path=audio_path,
        lyrics_path=lyrics_path,
        output_dir=output_dir,
    )


def _build_spotdl_command(
    query: str,
    output_dir: Path,
    *,
    audio_provider: str = "youtube-music",
    auth_token: str | None = None,
    disable_filter: bool = False,
) -> list[str]:
    spotdl_path = shutil.which("spotdl")
    if spotdl_path is not None:
        command = [
            spotdl_path,
            query,
            "--output",
            str(output_dir),
            "--format",
            "mp3",
            "--audio",
            audio_provider,
            "--lyrics",
            "synced",
            "--generate-lrc",
        ]
        _add_spotify_credentials(command, auth_token)
        if disable_filter:
            command.append("--dont-filter-results")
        return command

    uv_path = shutil.which("uv")
    if uv_path is not None:
        command = [
            uv_path,
            "run",
            "spotdl",
            query,
            "--output",
            str(output_dir),
            "--format",
            "mp3",
            "--audio",
            audio_provider,
            "--lyrics",
            "synced",
            "--generate-lrc",
        ]
        _add_spotify_credentials(command, auth_token)
        if disable_filter:
            command.append("--dont-filter-results")
        return command

    raise RuntimeError("spotdl is not available in PATH")


def _run_spotdl_command(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if show_output:
        if completed.stdout:
            print(completed.stdout, end="")
        if completed.stderr:
            print(completed.stderr, end="")
    return completed


def _combined_output(completed: subprocess.CompletedProcess[str]) -> str:
    return "\n".join(part for part in (completed.stdout, completed.stderr) if part)


def _add_spotify_credentials(command: list[str], auth_token: str | None) -> None:
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if client_id:
        command.extend(["--client-id", client_id])
    if client_secret:
        command.extend(["--client-secret", client_secret])
    if auth_token:
        command.extend(["--auth-token", auth_token])


def _get_spotify_auth_token() -> str | None:
    env_token = os.getenv("SPOTIFY_AUTH_TOKEN")
    if env_token:
        return env_token

    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    data = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
    ).encode()
    request = urllib.request.Request(
        "https://accounts.spotify.com/api/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:  # noqa: S310
        payload = json.load(response)
    return payload["access_token"]


def _should_retry_without_filter(output: str) -> bool:
    normalized = output.lower()
    return any(marker in normalized for marker in SPOTDL_RETRY_WITHOUT_FILTER_MARKERS)


def _should_try_next_provider(output: str) -> bool:
    normalized = output.lower()
    return any(marker in normalized for marker in SPOTDL_TRY_NEXT_PROVIDER_MARKERS)


def _get_spotdl_audio_providers() -> tuple[str, ...]:
    raw_value = os.getenv("SPOTDL_AUDIO_PROVIDERS")
    if raw_value is None:
        return SPOTDL_AUDIO_PROVIDERS

    providers = tuple(provider.strip() for provider in raw_value.split(",") if provider.strip())
    if not providers:
        raise RuntimeError("SPOTDL_AUDIO_PROVIDERS must include at least one provider")
    return providers


def _get_filter_attempt_order() -> tuple[bool, ...]:
    if _env_flag("SPOTDL_PREFER_DONT_FILTER"):
        return (True, False)
    return (False, True)


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in TRUTHY_ENV_VALUES


def _pick_audio_file(output_dir: Path) -> Path:
    candidates = _audio_files(output_dir)
    if not candidates:
        raise RuntimeError(f"spotdl finished but no audio file was found in {output_dir}")
    return candidates[0]


def _has_audio_file(output_dir: Path) -> bool:
    return bool(_audio_files(output_dir))


def _audio_files(output_dir: Path) -> list[Path]:
    candidates = sorted(
        path
        for path in output_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".mp3", ".m4a", ".wav", ".flac", ".opus", ".ogg"}
    )
    return candidates


def _pick_lyrics_file(output_dir: Path) -> Path | None:
    candidates = sorted(
        path
        for path in output_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".lrc", ".txt"}
    )
    if not candidates:
        return None
    return candidates[0]
