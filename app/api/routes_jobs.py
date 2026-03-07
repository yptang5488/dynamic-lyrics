from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.session import json_loads
from app.models.schemas import JobStatusResponse
from app.workers.job_runner import job_runner

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str) -> JobStatusResponse:
    job = job_runner.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="job not found"
        )

    result = json_loads(job["result_json"], None)
    return JobStatusResponse(
        id=job["id"],
        type=job["type"],
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
        result=result,
        errorMessage=job["error_message"],
    )
