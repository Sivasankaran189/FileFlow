import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from decimal import Decimal

from app.core.config import settings
from app.services.floci_client import floci_client

logger = logging.getLogger("fileflow.repository")


def _convert_floats_to_decimals(obj: Any) -> Any:
    """Helper to convert floats to Decimal for DynamoDB serialization."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _convert_floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_floats_to_decimals(v) for v in obj]
    return obj


def _convert_decimals_to_native(obj: Any) -> Any:
    """Helper to convert Decimals from DynamoDB back to int/float for JSON response."""
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    elif isinstance(obj, dict):
        return {k: _convert_decimals_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_decimals_to_native(v) for v in obj]
    return obj


class JobRepository:
    """
    Thread-safe repository for FileFlow Jobs.
    
    Interacts with the user's pre-created DynamoDB table in Floci.
    IMPORTANT:
    Does NOT use boto3 to create any DynamoDB tables.
    Also mirrors to a persistent local JSON store (storage/jobs.json) so the platform
    functions reliably under all conditions.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self.storage_file = settings.STORAGE_DIR / "jobs.json"
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_local()

        # Seed with initial records if empty
        if not self._jobs:
            self._seed_initial_jobs()

    def _get_dynamo_table(self):
        """Returns the user's pre-created DynamoDB Table in Floci, or None if not accessible."""
        try:
            db = floci_client.get_dynamodb_resource()
            table = db.Table(settings.DYNAMODB_TABLE_NAME)
            table.load()
            return table
        except Exception:
            return None

    def _load_local(self):
        if self.storage_file.exists():
            try:
                data = json.loads(self.storage_file.read_text(encoding="utf-8"))
                with self._lock:
                    self._jobs = {item["id"]: item for item in data}
            except Exception:
                self._jobs = {}

    def _save_local(self):
        with self._lock:
            data = list(self._jobs.values())
        try:
            self.storage_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _seed_initial_jobs(self):
        sample_results = {
            "totalRows": 1250,
            "validRows": 1180,
            "invalidRows": 50,
            "duplicateRows": 20,
            "errorBreakdown": [
                {"row": 14, "column": "email", "issue": "Malformed email address format", "value": "user_at_domain"},
                {"row": 42, "column": "amount", "issue": "Negative amount not allowed", "value": "-45.00"},
                {"row": 89, "column": "created_at", "issue": "Invalid ISO 8601 timestamp", "value": "2026/13/45"},
                {"row": 112, "column": "quantity", "issue": "Expected integer, received string", "value": "ten"},
            ],
            "columns": ["transaction_id", "email", "amount", "quantity", "created_at"],
            "columnCount": 5,
        }

        self.create_job(
            job_id="job-8f921a-2026",
            file_name="q3_transactions.csv",
            file_size="4.2 MB",
            file_size_bytes=4404019,
            status="COMPLETED",
            submitted_at="10 mins ago",
            elapsed_time="2.4s",
            results=sample_results,
        )

        self.create_job(
            job_id="job-3a47c0-2026",
            file_name="customer_leads.csv",
            file_size="1.1 MB",
            file_size_bytes=1153433,
            status="FAILED",
            submitted_at="1 hour ago",
            elapsed_time="0.8s",
            error="Missing required column: 'account_id'",
        )

    def create_job(
        self,
        file_name: str,
        file_size: str,
        file_size_bytes: int,
        job_id: Optional[str] = None,
        status: str = "QUEUED",
        submitted_at: Optional[str] = None,
        elapsed_time: Optional[str] = None,
        results: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not job_id:
            import uuid
            job_id = f"job-{uuid.uuid4().hex[:6]}-{int(time.time())}"

        if not submitted_at:
            submitted_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        job = {
            "id": job_id,
            "fileName": file_name,
            "fileSize": file_size,
            "fileSizeBytes": file_size_bytes,
            "status": status,
            "submittedAt": submitted_at,
            "elapsedTime": elapsed_time or "0s",
            "results": results,
            "error": error,
            "created_timestamp": time.time(),
        }

        # 1. Update local cache
        with self._lock:
            self._jobs[job_id] = job
        self._save_local()

        # 2. Write to Floci DynamoDB (if table is pre-created by user)
        table = self._get_dynamo_table()
        if table:
            try:
                dynamo_item = _convert_floats_to_decimals(job)
                table.put_item(Item=dynamo_item)
                logger.info(f"Persisted job {job_id} to Floci DynamoDB table {settings.DYNAMODB_TABLE_NAME}")
            except Exception as e:
                logger.warning(f"Floci DynamoDB put_item skipped/failed: {e}")

        return job

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        # Check Floci DynamoDB first
        table = self._get_dynamo_table()
        if table:
            try:
                response = table.get_item(Key={"id": job_id})
                item = response.get("Item")
                if item:
                    converted = _convert_decimals_to_native(item)
                    with self._lock:
                        self._jobs[job_id] = converted
                    return converted
            except Exception:
                pass

        # Local cache fallback
        with self._lock:
            return self._jobs.get(job_id)

    def update_job(self, job_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            if job_id not in self._jobs:
                return None
            self._jobs[job_id].update(updates)
            updated = dict(self._jobs[job_id])
        self._save_local()

        # Update Floci DynamoDB
        table = self._get_dynamo_table()
        if table:
            try:
                dynamo_item = _convert_floats_to_decimals(updated)
                table.put_item(Item=dynamo_item)
            except Exception as e:
                logger.warning(f"Floci DynamoDB update_item failed: {e}")

        return updated

    def list_jobs(self) -> List[Dict[str, Any]]:
        # Scan Floci DynamoDB if available
        table = self._get_dynamo_table()
        if table:
            try:
                response = table.scan()
                items = response.get("Items", [])
                if items:
                    converted_list = [_convert_decimals_to_native(item) for item in items]
                    with self._lock:
                        for it in converted_list:
                            self._jobs[it["id"]] = it
                    return sorted(converted_list, key=lambda j: j.get("created_timestamp", 0), reverse=True)
            except Exception:
                pass

        # Local cache fallback
        with self._lock:
            jobs = list(self._jobs.values())
        return sorted(jobs, key=lambda j: j.get("created_timestamp", 0), reverse=True)

    def delete_job(self, job_id: str) -> bool:
        existed = False
        with self._lock:
            if job_id in self._jobs:
                del self._jobs[job_id]
                existed = True
        if existed:
            self._save_local()

        # Delete from Floci DynamoDB
        table = self._get_dynamo_table()
        if table:
            try:
                table.delete_item(Key={"id": job_id})
            except Exception as e:
                logger.warning(f"Floci DynamoDB delete_item failed: {e}")

        return existed


job_repository = JobRepository()
