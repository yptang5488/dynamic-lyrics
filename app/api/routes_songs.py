from __future__ import annotations

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
    SongLyricNotesUpdateRequest,
    SongLyricOffsetUpdateRequest,
    SongMetadataUpdateRequest,
    SongResponse,
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
                has_notes=any(len(line.notes) > 0 for line in payload.lyrics),
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
    update_record(
        "songs",
        song_id,
        {
            "title": title,
            "artist": artist,
            "lyrics_json": json_dumps(next_payload),
            "updated_at": utc_now(),
        },
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
    update_record(
        "songs",
        song_id,
        {
            "lyrics_json": json_dumps(next_payload),
            "updated_at": utc_now(),
        },
    )
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

    update_record(
        "songs",
        song_id,
        {
            "lyrics_json": json_dumps(next_payload),
            "updated_at": utc_now(),
        },
    )
    return SongResponse.model_validate(next_payload)


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_song(song_id: str) -> None:
    if not delete_record("songs", song_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )
