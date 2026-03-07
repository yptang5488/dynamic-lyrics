from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import AlignmentRequest, JobCreatedResponse
from app.services.source_service import fetch_source
from app.workers.job_runner import job_runner

router = APIRouter(prefix="/alignments", tags=["alignments"])


@router.post(
    "", response_model=JobCreatedResponse, status_code=status.HTTP_202_ACCEPTED
)
def create_alignment(payload: AlignmentRequest) -> JobCreatedResponse:
    source = fetch_source(payload.source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="source not found"
        )
    if source["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="source failed to import"
        )

    job_id = job_runner.submit_alignment(
        source_id=payload.source_id,
        language=payload.language,
        lyrics_text=payload.lyrics_text,
        translations=payload.translations,
    )
    return JobCreatedResponse(jobId=job_id, status="queued")
