from __future__ import annotations

import shutil
import sys
import time
from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import Settings


@pytest.fixture
def test_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Settings:
    data_dir = tmp_path / "data"
    settings = Settings(
        db_path=tmp_path / "test.db",
        raw_dir=data_dir / "raw",
        normalized_dir=data_dir / "normalized",
        export_dir=data_dir / "export",
    )

    import app.config as config_module
    import app.db.session as session_module
    import app.main as app_main_module
    import app.services.audio_normalize as audio_normalize_module
    import app.services.song_builder as song_builder_module
    import app.services.source_service as source_service_module

    monkeypatch.setattr(config_module, "settings", settings)
    monkeypatch.setattr(session_module, "settings", settings)
    monkeypatch.setattr(app_main_module, "settings", settings)
    monkeypatch.setattr(audio_normalize_module, "settings", settings)
    monkeypatch.setattr(song_builder_module, "settings", settings)
    monkeypatch.setattr(source_service_module, "settings", settings)

    def fake_normalize_audio(source_id: str, original_path: Path) -> Path:
        normalized_path = settings.normalized_dir / f"{source_id}{original_path.suffix}"
        normalized_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original_path, normalized_path)
        return normalized_path

    monkeypatch.setattr(source_service_module, "normalize_audio", fake_normalize_audio)
    monkeypatch.setattr(source_service_module, "probe_duration", lambda path: 123.4)

    settings.ensure_storage()
    session_module.init_db()
    return settings


@pytest.fixture
def client(test_settings: Settings) -> Iterator[TestClient]:
    import app.main as app_main_module

    app = app_main_module.create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def wait_for_job_completion():
    def _wait(client: TestClient, job_id: str, timeout: float = 2.0) -> dict:
        deadline = time.time() + timeout
        last_payload: dict | None = None

        while time.time() < deadline:
            response = client.get(f"/api/jobs/{job_id}")
            response.raise_for_status()
            payload = response.json()
            last_payload = payload
            if payload["status"] in {"done", "failed"}:
                return payload
            time.sleep(0.05)

        raise AssertionError(f"job {job_id} did not finish in time: {last_payload}")

    return _wait
