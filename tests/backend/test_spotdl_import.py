from __future__ import annotations

import subprocess
from pathlib import Path

from app.config import Settings
from app.services import spotdl_import


def test_import_spotify_audio_retries_with_next_provider_after_ytmusic_block(
    tmp_path: Path, monkeypatch
) -> None:
    settings = Settings(raw_dir=tmp_path / "raw")
    settings.raw_dir.mkdir(parents=True)
    monkeypatch.setattr(spotdl_import, "settings", settings)
    monkeypatch.setattr(spotdl_import, "_get_spotify_auth_token", lambda: None)

    calls: list[list[str]] = []

    def fake_run(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        provider = command[command.index("--audio") + 1]
        if provider == "youtube-music":
            return subprocess.CompletedProcess(
                command,
                1,
                stdout="",
                stderr="You are blocked by YouTube Music",
            )

        output_dir = Path(command[command.index("--output") + 1])
        (output_dir / "downloaded.mp3").write_bytes(b"audio")
        return subprocess.CompletedProcess(command, 0, stdout="Downloaded", stderr="")

    monkeypatch.setattr(spotdl_import, "_run_spotdl_command", fake_run)

    result = spotdl_import.import_spotify_audio("source", "NewJeans - Ditto")

    assert result.audio_path.name == "downloaded.mp3"
    assert [call[call.index("--audio") + 1] for call in calls] == ["youtube-music", "youtube"]


def test_import_spotify_audio_retries_without_filter_after_filtered_results(
    tmp_path: Path, monkeypatch
) -> None:
    settings = Settings(raw_dir=tmp_path / "raw")
    settings.raw_dir.mkdir(parents=True)
    monkeypatch.setattr(spotdl_import, "settings", settings)
    monkeypatch.setattr(spotdl_import, "_get_spotify_auth_token", lambda: None)

    calls: list[list[str]] = []

    def fake_run(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        if "--dont-filter-results" not in command:
            return subprocess.CompletedProcess(
                command,
                0,
                stdout="Filtered to 0 results",
                stderr="",
            )

        output_dir = Path(command[command.index("--output") + 1])
        (output_dir / "downloaded.mp3").write_bytes(b"audio")
        return subprocess.CompletedProcess(command, 0, stdout="Downloaded", stderr="")

    monkeypatch.setattr(spotdl_import, "_run_spotdl_command", fake_run)

    result = spotdl_import.import_spotify_audio("source", "NewJeans - Ditto")

    assert result.audio_path.name == "downloaded.mp3"
    assert "--dont-filter-results" not in calls[0]
    assert "--dont-filter-results" in calls[1]


def test_import_spotify_audio_zero_exit_without_audio_is_not_success(
    tmp_path: Path, monkeypatch
) -> None:
    settings = Settings(raw_dir=tmp_path / "raw")
    settings.raw_dir.mkdir(parents=True)
    monkeypatch.setattr(spotdl_import, "settings", settings)
    monkeypatch.setattr(spotdl_import, "_get_spotify_auth_token", lambda: None)

    calls: list[list[str]] = []

    def fake_run(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        provider = command[command.index("--audio") + 1]
        if provider == "piped":
            output_dir = Path(command[command.index("--output") + 1])
            (output_dir / "downloaded.mp3").write_bytes(b"audio")
            return subprocess.CompletedProcess(command, 0, stdout="Downloaded", stderr="")
        return subprocess.CompletedProcess(
            command,
            0,
            stdout="No results found for song",
            stderr="",
        )

    monkeypatch.setattr(spotdl_import, "_run_spotdl_command", fake_run)

    result = spotdl_import.import_spotify_audio("source", "NewJeans - Ditto")

    assert result.audio_path.name == "downloaded.mp3"
    assert calls[-1][calls[-1].index("--audio") + 1] == "piped"


def test_build_spotdl_command_includes_credentials(monkeypatch) -> None:
    monkeypatch.setenv("SPOTIFY_CLIENT_ID", "client-id")
    monkeypatch.setenv("SPOTIFY_CLIENT_SECRET", "client-secret")
    monkeypatch.setattr(spotdl_import.shutil, "which", lambda name: "/bin/spotdl" if name == "spotdl" else None)

    command = spotdl_import._build_spotdl_command(
        "NewJeans - Ditto",
        Path("output"),
        auth_token="token",
    )

    assert command[0] == "/bin/spotdl"
    assert command[command.index("--client-id") + 1] == "client-id"
    assert command[command.index("--client-secret") + 1] == "client-secret"
    assert command[command.index("--auth-token") + 1] == "token"


def test_import_spotify_audio_uses_configured_provider_order(tmp_path: Path, monkeypatch) -> None:
    settings = Settings(raw_dir=tmp_path / "raw")
    settings.raw_dir.mkdir(parents=True)
    monkeypatch.setenv("SPOTDL_AUDIO_PROVIDERS", "youtube,piped")
    monkeypatch.setattr(spotdl_import, "settings", settings)
    monkeypatch.setattr(spotdl_import, "_get_spotify_auth_token", lambda: None)

    calls: list[list[str]] = []

    def fake_run(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        output_dir = Path(command[command.index("--output") + 1])
        (output_dir / "downloaded.mp3").write_bytes(b"audio")
        return subprocess.CompletedProcess(command, 0, stdout="Downloaded", stderr="")

    monkeypatch.setattr(spotdl_import, "_run_spotdl_command", fake_run)

    spotdl_import.import_spotify_audio("source", "NewJeans - Ditto")

    assert [call[call.index("--audio") + 1] for call in calls] == ["youtube"]


def test_import_spotify_audio_can_prefer_unfiltered_search(tmp_path: Path, monkeypatch) -> None:
    settings = Settings(raw_dir=tmp_path / "raw")
    settings.raw_dir.mkdir(parents=True)
    monkeypatch.setenv("SPOTDL_AUDIO_PROVIDERS", "youtube,piped")
    monkeypatch.setenv("SPOTDL_PREFER_DONT_FILTER", "true")
    monkeypatch.setattr(spotdl_import, "settings", settings)
    monkeypatch.setattr(spotdl_import, "_get_spotify_auth_token", lambda: None)

    calls: list[list[str]] = []

    def fake_run(command: list[str], *, show_output: bool) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        output_dir = Path(command[command.index("--output") + 1])
        (output_dir / "downloaded.mp3").write_bytes(b"audio")
        return subprocess.CompletedProcess(command, 0, stdout="Downloaded", stderr="")

    monkeypatch.setattr(spotdl_import, "_run_spotdl_command", fake_run)

    spotdl_import.import_spotify_audio("source", "NewJeans - Ditto")

    assert calls[0][calls[0].index("--audio") + 1] == "youtube"
    assert "--dont-filter-results" in calls[0]
