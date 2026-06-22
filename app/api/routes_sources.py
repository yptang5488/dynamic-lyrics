from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.models.schemas import (
    SourceDetailResponse,
    SourceResponse,
    SpotifyImportRequest,
    SpotifyImportResponse,
    YoutubeImportRequest,
    YoutubeImportResponse,
)
from app.services.source_service import (
    create_pending_spotify_source,
    create_pending_youtube_source,
    create_uploaded_source,
    fetch_source,
)
from app.services.youtube_import import sanitize_youtube_url
from app.workers.job_runner import job_runner

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post(
    "/upload-audio", response_model=SourceResponse, status_code=status.HTTP_201_CREATED
)
def upload_audio(file: UploadFile = File(...)) -> SourceResponse:
    source = create_uploaded_source(file)
    return SourceResponse(
        sourceId=source["id"], status=source["status"], type=source["type"]
    )


@router.post(
    "/import-youtube",
    response_model=YoutubeImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def import_youtube(payload: YoutubeImportRequest) -> YoutubeImportResponse:
    sanitized_url = sanitize_youtube_url(str(payload.url))
    source = create_pending_youtube_source(sanitized_url)
    job_id = job_runner.submit_youtube_import(source["id"], sanitized_url)
    return YoutubeImportResponse(sourceId=source["id"], jobId=job_id, status="queued")


@router.post(
    "/import-spotify",
    response_model=SpotifyImportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def import_spotify(payload: SpotifyImportRequest) -> SpotifyImportResponse:
    query = payload.query.strip()
    source = create_pending_spotify_source(query)
    job_id = job_runner.submit_spotify_import(source["id"], query)
    return SpotifyImportResponse(sourceId=source["id"], jobId=job_id, status="queued")


@router.get("/{source_id}", response_model=SourceDetailResponse)
def get_source(source_id: str) -> SourceDetailResponse:
    source = fetch_source(source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="source not found"
        )
    return SourceDetailResponse(
        id=source["id"],
        type=source["type"],
        status=source["status"],
        sourceUrl=source["source_url"],
        title=source["title"],
        artist=source["artist"],
        duration=source["duration"],
        errorMessage=source["error_message"],
    )
