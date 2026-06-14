from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.db.session import delete_record, fetch_one, fetch_ready_song_rows, json_loads
from app.models.schemas import SongCatalogEntry, SongResponse

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


@router.delete("/{song_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_song(song_id: str) -> None:
    if not delete_record("songs", song_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )
