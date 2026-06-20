from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import app.config as config
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.db.session import (
    delete_record,
    fetch_one,
    fetch_ready_song_rows,
    json_dumps,
    json_loads,
    update_record,
    utc_now,
)
from app.models.schemas import (
    SongCatalogEntry,
    SongChantEventsUpdateRequest,
    SongLyricNotesUpdateRequest,
    SongLyricOffsetUpdateRequest,
    SongMetadataUpdateRequest,
    SongResponse,
    SongTimingShiftRequest,
)
from app.services.chant_romanization import normalize_chant_notes

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("", response_model=list[SongCatalogEntry])
def list_songs() -> list[SongCatalogEntry]:
    entries: list[SongCatalogEntry] = []
    for song in fetch_ready_song_rows():
        try:
            payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
        except (TypeError, ValueError, ValidationError):
            continue

        entries.append(
            SongCatalogEntry(
                id=song["id"],
                title=song["title"],
                artist=song["artist"],
                has_lyrics=len(payload.lyrics) > 0,
                has_translation=any(line.translation for line in payload.lyrics),
                has_notes=bool(payload.chant_events)
                or any(len(line.notes) > 0 for line in payload.lyrics),
                player_path=f"/player/{song['id']}",
            )
        )
    return entries


@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: str) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )
    payload = json_loads(song["lyrics_json"], {})
    return SongResponse.model_validate(payload)


@router.patch("/{song_id}/metadata", response_model=SongResponse)
def update_song_metadata(song_id: str, request: SongMetadataUpdateRequest) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    title = request.title.strip()
    artist = request.artist.strip()
    if not title or not artist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="title and artist are required",
        )

    payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
    next_payload = payload.model_dump(by_alias=True)
    next_payload["title"] = title
    next_payload["artist"] = artist
    if request.trim_start is not None:
        next_payload["audio"]["trimStart"] = round(request.trim_start, 1)
    if request.trim_end is not None:
        next_payload["audio"]["trimEnd"] = round(request.trim_end, 1)
    persist_song_payload(
        song_id,
        next_payload,
        {"title": title, "artist": artist},
    )
    return SongResponse.model_validate(next_payload)


@router.patch("/{song_id}/lyric-offset", response_model=SongResponse)
def update_song_lyric_offset(
    song_id: str, request: SongLyricOffsetUpdateRequest
) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
    next_payload = payload.model_dump(by_alias=True)
    next_payload["lyricOffset"] = round(request.lyric_offset, 1)
    persist_song_payload(song_id, next_payload)
    return SongResponse.model_validate(next_payload)


@router.patch("/{song_id}/timing-shift", response_model=SongResponse)
def shift_song_timing(song_id: str, request: SongTimingShiftRequest) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
    start_index = next(
        (index for index, line in enumerate(payload.lyrics) if line.id == request.from_line_id),
        None,
    )
    if start_index is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unknown lyric line id: {request.from_line_id}",
        )

    next_payload = payload.model_dump(by_alias=True)
    lines_to_shift = next_payload["lyrics"][start_index:]
    validate_shifted_times(lines_to_shift, request.offset)

    backup_song_file(song_id)
    for line in lines_to_shift:
        shift_timed_payload(line, request.offset)
        for segment in line.get("segments", []):
            if isinstance(segment, dict):
                shift_timed_payload(segment, request.offset)

    persist_song_payload(song_id, next_payload)
    return SongResponse.model_validate(next_payload)


@router.patch("/{song_id}/lyric-notes", response_model=SongResponse)
def update_song_lyric_notes(
    song_id: str, request: SongLyricNotesUpdateRequest
) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
    line_updates = {item.line_id: item.notes for item in request.lyric_notes}
    known_line_ids = {line.id for line in payload.lyrics}
    unknown_line_ids = set(line_updates) - known_line_ids
    if unknown_line_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unknown lyric line id: {sorted(unknown_line_ids)[0]}",
        )

    next_payload = payload.model_dump(by_alias=True)
    for line in next_payload["lyrics"]:
        if line["id"] in line_updates:
            line["notes"] = normalize_chant_notes(line_updates[line["id"]])

    persist_song_payload(song_id, next_payload)
    return SongResponse.model_validate(next_payload)


@router.patch("/{song_id}/chant-events", response_model=SongResponse)
def update_song_chant_events(
    song_id: str, request: SongChantEventsUpdateRequest
) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    for event in request.chant_events:
        if event.end <= event.start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="chant event end must be after start",
            )
        if not event.text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="chant event text is required",
            )

    payload = SongResponse.model_validate(json_loads(song["lyrics_json"], {}))
    next_payload = payload.model_dump(by_alias=True)
    next_payload["chantEvents"] = [
        event.model_dump(by_alias=True)
        for event in sorted(request.chant_events, key=lambda item: item.start)
    ]
    persist_song_payload(song_id, next_payload)
    return SongResponse.model_validate(next_payload)


def validate_shifted_times(lines: list[dict[str, Any]], offset: float) -> None:
    for line in lines:
        for payload in [line, *line.get("segments", [])]:
            if not isinstance(payload, dict):
                continue
            for field in ("start", "end"):
                value = payload.get(field)
                if isinstance(value, (int, float)) and round(value + offset, 3) < 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="timing shift would create a negative timestamp",
                    )


def shift_timed_payload(payload: dict[str, Any], offset: float) -> None:
    for field in ("start", "end"):
        value = payload.get(field)
        if isinstance(value, (int, float)):
            payload[field] = round(value + offset, 3)


def backup_song_file(song_id: str) -> None:
    song_path = config.settings.raw_dir.parent / "songs" / f"{song_id}.json"
    if not song_path.exists():
        return
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_dir = config.settings.raw_dir.parent / "backups" / "songs"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(song_path, backup_dir / f"{song_id}.{timestamp}.json")


def persist_song_payload(
    song_id: str,
    payload: dict,
    record_updates: dict | None = None,
) -> None:
    updates = dict(record_updates or {})
    updates.update({"lyrics_json": json_dumps(payload), "updated_at": utc_now()})
    update_record("songs", song_id, updates)

    export_path = config.settings.export_dir / f"{song_id}.json"
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_song(song_id: str) -> None:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )

    if not delete_record("songs", song_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )
    delete_song_files(song_id)
    delete_unused_source(song.get("source_id"))


def delete_song_files(song_id: str) -> None:
    data_dir = config.settings.raw_dir.parent
    for path in (
        config.settings.export_dir / f"{song_id}.json",
        data_dir / "chant-guides" / f"{song_id}.json",
        data_dir / "chant-sources" / f"{song_id}.md",
    ):
        path.unlink(missing_ok=True)


def delete_unused_source(source_id: str | None) -> None:
    if not source_id or source_is_used(source_id):
        return

    source = fetch_one("sources", source_id)
    if not source:
        return

    delete_record("sources", source_id)
    for value in (source.get("original_path"), source.get("normalized_path")):
        if value:
            delete_source_file(Path(value))


def delete_source_file(path: Path) -> None:
    data_dir = config.settings.raw_dir.parent.resolve()
    resolved_path = path.resolve()
    if resolved_path.is_relative_to(data_dir):
        resolved_path.unlink(missing_ok=True)


def source_is_used(source_id: str) -> bool:
    songs_dir = config.settings.raw_dir.parent / "songs"
    for path in songs_dir.glob("*.json"):
        try:
            if json.loads(path.read_text(encoding="utf-8")).get("source_id") == source_id:
                return True
        except (OSError, ValueError):
            continue
    return False
