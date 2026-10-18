import time
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.core.config import settings
from app.services.floci_client import floci_client
from app.services.storage_service import storage_service
from app.services.validator_service import validator_service
from app.services.job_repository import job_repository

logger = logging.getLogger("fileflow.worker")


class CSVWorker:
    """
    Asynchronous CSV Processing Worker.
    
    If the user has created the SQS queue in Floci, messages are sent to SQS.
    Executes validation, deduplication, schema check, and cleaning in a concurrent
    ThreadPool to guarantee fast and reliable processing.
    
    IMPORTANT:
    Does NOT use boto3 to create SQS queues.
    """

    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="fileflow-worker")

    def enqueue_job(self, job_id: str, filename: str, content: bytes):
        """Dispatches job processing asynchronously."""
        # 1. Publish to Floci SQS (if queue pre-created by user)
        try:
            sqs = floci_client.get_sqs_client()
            queue_info = sqs.get_queue_url(QueueName=settings.SQS_QUEUE_NAME)
            queue_url = queue_info["QueueUrl"]
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"job_id": job_id, "filename": filename}),
            )
            logger.info(f"Published job {job_id} to Floci SQS queue: {queue_url}")
        except Exception as e:
            logger.debug(f"Floci SQS publish skipped/unreachable: {e}")

        # 2. Execute processing concurrently
        self.executor.submit(self._process_job, job_id, filename, content)

    def _process_job(self, job_id: str, filename: str, content: bytes):
        start_time = time.time()
        logger.info(f"Worker started processing job {job_id} ({filename})")

        job_repository.update_job(job_id, {
            "status": "PROCESSING",
            "elapsedTime": "Running...",
        })

        # Pipeline visual delay (0.8s) for smooth frontend transition
        time.sleep(0.8)

        try:
            results, cleaned_csv = validator_service.validate_and_clean(content, filename)

            # Persist artifacts (to S3 if bucket exists + local backup)
            storage_service.save_cleaned_file(job_id, filename, cleaned_csv)
            storage_service.save_report(job_id, {
                "jobId": job_id,
                "fileName": filename,
                "processedAt": time.strftime("%Y-%m-%d %H:%M:%SZ", time.gmtime()),
                "summary": results,
            })

            elapsed = f"{time.time() - start_time:.2f}s"

            job_repository.update_job(job_id, {
                "status": "COMPLETED",
                "results": results,
                "elapsedTime": elapsed,
                "error": None,
            })
            logger.info(f"Job {job_id} successfully completed in {elapsed}")

        except Exception as exc:
            elapsed = f"{time.time() - start_time:.2f}s"
            error_msg = str(exc)
            logger.error(f"Job {job_id} failed: {error_msg}")
            job_repository.update_job(job_id, {
                "status": "FAILED",
                "error": error_msg,
                "elapsedTime": elapsed,
                "results": None,
            })


csv_worker = CSVWorker()
