from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import SyncedLrcSearchRequest, SyncedLrcSearchResponse
from app.services.synced_lrc_import import fetch_synced_lrc

router = APIRouter(prefix="/lyrics", tags=["lyrics"])


@router.post("/search-synced", response_model=SyncedLrcSearchResponse)
def search_synced_lrc(payload: SyncedLrcSearchRequest) -> SyncedLrcSearchResponse:
    try:
        lrc_text = fetch_synced_lrc(payload.query, payload.providers)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return SyncedLrcSearchResponse(
        lrcText=lrc_text,
        warnings=["Verify this LRC matches the selected audio before importing."],
    )
