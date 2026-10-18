import json
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from typing import List

from app.services.job_repository import job_repository
from app.services.storage_service import storage_service
from app.services.validator_service import validator_service
from app.worker.csv_worker import csv_worker

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def format_bytes(byte_count: int) -> str:
    if byte_count < 1024:
        return f"{byte_count} B"
    elif byte_count < 1024 * 1024:
        return f"{byte_count / 1024:.1f} KB"
    else:
        return f"{byte_count / (1024 * 1024):.2f} MB"


@router.get("", response_model=List[dict])
async def list_all_jobs():
    """Retrieve full audit history of all processed and pending jobs."""
    return job_repository.list_jobs()


@router.get("/{job_id}")
async def get_job_by_id(job_id: str):
    """Retrieve specific job status, metrics, and error breakdown."""
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job


@router.post("/upload")
async def upload_csv_file(file: UploadFile = File(...)):
    """Upload a CSV dataset to initiate validation and cleaning pipeline."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV files are supported.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty.")

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="The file exceeds the maximum permitted limit of 10 MB.")

    file_size_str = format_bytes(len(content))

    # Register job in repository
    job = job_repository.create_job(
        file_name=file.filename,
        file_size=file_size_str,
        file_size_bytes=len(content),
        status="QUEUED",
    )

    # Save raw upload into Floci S3 / local storage
    storage_service.save_raw_file(job["id"], file.filename, content)

    # Enqueue worker
    csv_worker.enqueue_job(job["id"], file.filename, content)

    return job


@router.post("/sample")
async def process_sample_data():
    """Generates and triggers a processing job on a pre-built sample CSV with realistic errors."""
    sample_csv = validator_service.generate_sample_csv()
    content = sample_csv.encode("utf-8")
    filename = "enterprise_sample_dataset.csv"
    file_size_str = format_bytes(len(content))

    job = job_repository.create_job(
        file_name=filename,
        file_size=file_size_str,
        file_size_bytes=len(content),
        status="QUEUED",
    )

    storage_service.save_raw_file(job["id"], filename, content)
    csv_worker.enqueue_job(job["id"], filename, content)
    return job


@router.get("/{job_id}/download/cleaned")
async def download_cleaned_csv(job_id: str):
    """Download the cleaned, deduplicated, and formatted CSV file."""
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    cleaned_content = storage_service.get_cleaned_file(job_id, job["fileName"])
    if not cleaned_content:
        raise HTTPException(status_code=404, detail="Cleaned CSV artifact not found or processing incomplete.")

    cleaned_filename = f"cleaned_{job['fileName']}"
    return Response(
        content=cleaned_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{cleaned_filename}"'},
    )


@router.get("/{job_id}/download/report")
async def download_audit_report(job_id: str):
    """Download the full JSON audit and data quality validation report."""
    job = job_repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    report = storage_service.get_report(job_id)
    if not report:
        report = {
            "jobId": job["id"],
            "fileName": job["fileName"],
            "status": job["status"],
            "submittedAt": job["submittedAt"],
            "elapsedTime": job.get("elapsedTime"),
            "results": job.get("results"),
            "error": job.get("error"),
        }

    report_str = json.dumps(report, indent=2)
    return Response(
        content=report_str,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="audit_report_{job_id}.json"'},
    )


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated storage artifacts."""
    existed = job_repository.delete_job(job_id)
    if not existed:
        raise HTTPException(status_code=404, detail="Job not found.")
    storage_service.delete_job_files(job_id)
    return {"status": "success", "message": f"Job {job_id} deleted."}
