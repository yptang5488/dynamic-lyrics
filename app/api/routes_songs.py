from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.session import fetch_one, json_loads
from app.models.schemas import SongResponse

router = APIRouter(prefix="/songs", tags=["songs"])


@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: str) -> SongResponse:
    song = fetch_one("songs", song_id)
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="song not found"
        )
    payload = json_loads(song["lyrics_json"], {})
    return SongResponse.model_validate(payload)
