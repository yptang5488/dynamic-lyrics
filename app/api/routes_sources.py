from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.models.schemas import (
    SourceDetailResponse,
    SourceResponse,
    YoutubeImportRequest,
    YoutubeImportResponse,
)
from app.services.source_service import (
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
        title=source["title"],
        artist=source["artist"],
        duration=source["duration"],
        errorMessage=source["error_message"],
    )
