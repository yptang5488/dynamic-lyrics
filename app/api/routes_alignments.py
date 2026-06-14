from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import JobCreatedResponse, LrcImportRequest
from app.services.source_service import fetch_source
from app.workers.job_runner import job_runner

router = APIRouter(prefix="/alignments", tags=["alignments"])


@router.post(
    "/from-lrc", response_model=JobCreatedResponse, status_code=status.HTTP_202_ACCEPTED
)
def create_lrc_import(payload: LrcImportRequest) -> JobCreatedResponse:
    source = fetch_source(payload.source_id)
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="source not found"
        )
    if source["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="source failed to import"
        )

    job_id = job_runner.submit_lrc_import(
        source_id=payload.source_id,
        lrc_text=payload.lrc_text,
    )
    return JobCreatedResponse(jobId=job_id, status="queued")
