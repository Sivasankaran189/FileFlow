import io
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from app.core.config import settings
from app.services.floci_client import floci_client

logger = logging.getLogger("fileflow.storage")


class StorageService:
    """
    Handles CSV artifact persistence across Floci S3 and local storage.
    
    Interacts with the user's pre-created S3 bucket in Floci.
    Does NOT attempt to create S3 buckets.
    Always maintains a local filesystem copy in storage/ for resilient operation.
    """

    def __init__(self):
        self.local_dir = settings.STORAGE_DIR
        self.local_dir.mkdir(parents=True, exist_ok=True)
        (self.local_dir / "raw").mkdir(exist_ok=True)
        (self.local_dir / "cleaned").mkdir(exist_ok=True)
        (self.local_dir / "reports").mkdir(exist_ok=True)

    def is_cloud_connected(self) -> bool:
        """Checks if S3 bucket in Floci is reachable."""
        try:
            s3 = floci_client.get_s3_client()
            s3.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            return True
        except Exception:
            return False

    def save_raw_file(self, job_id: str, filename: str, content: bytes) -> bool:
        """Saves raw CSV upload to Floci S3 and local storage."""
        # 1. Local backup
        try:
            local_job_dir = self.local_dir / "raw" / job_id
            local_job_dir.mkdir(parents=True, exist_ok=True)
            (local_job_dir / filename).write_bytes(content)
        except Exception as e:
            logger.warning(f"Failed to write local raw file: {e}")

        # 2. Floci S3 upload (if bucket exists)
        try:
            s3 = floci_client.get_s3_client()
            s3_key = f"raw/{job_id}/{filename}"
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=content,
                ContentType="text/csv",
            )
            logger.info(f"Uploaded raw file to Floci S3: s3://{settings.S3_BUCKET_NAME}/{s3_key}")
            return True
        except Exception as e:
            logger.warning(f"Floci S3 upload skipped/failed: {e}")
            return False

    def save_cleaned_file(self, job_id: str, filename: str, content_str: str) -> bool:
        """Saves validated, deduplicated CSV output."""
        cleaned_filename = f"cleaned_{filename}"
        content_bytes = content_str.encode("utf-8")

        # 1. Local backup
        try:
            local_job_dir = self.local_dir / "cleaned" / job_id
            local_job_dir.mkdir(parents=True, exist_ok=True)
            (local_job_dir / cleaned_filename).write_bytes(content_bytes)
        except Exception as e:
            logger.warning(f"Failed to write local cleaned file: {e}")

        # 2. Floci S3 upload
        try:
            s3 = floci_client.get_s3_client()
            s3_key = f"cleaned/{job_id}/{cleaned_filename}"
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=content_bytes,
                ContentType="text/csv",
            )
            logger.info(f"Saved cleaned file to Floci S3: s3://{settings.S3_BUCKET_NAME}/{s3_key}")
            return True
        except Exception as e:
            logger.warning(f"Floci S3 cleaned file upload skipped/failed: {e}")
            return False

    def save_report(self, job_id: str, report_dict: Dict[str, Any]) -> bool:
        """Saves JSON audit report."""
        report_bytes = json.dumps(report_dict, indent=2).encode("utf-8")

        # 1. Local backup
        try:
            local_job_dir = self.local_dir / "reports" / job_id
            local_job_dir.mkdir(parents=True, exist_ok=True)
            (local_job_dir / "audit_report.json").write_bytes(report_bytes)
        except Exception as e:
            logger.warning(f"Failed to write local report file: {e}")

        # 2. Floci S3 upload
        try:
            s3 = floci_client.get_s3_client()
            s3_key = f"reports/{job_id}/audit_report.json"
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=report_bytes,
                ContentType="application/json",
            )
            logger.info(f"Saved report to Floci S3: s3://{settings.S3_BUCKET_NAME}/{s3_key}")
            return True
        except Exception as e:
            logger.warning(f"Floci S3 report upload skipped/failed: {e}")
            return False

    def get_cleaned_file(self, job_id: str, filename: str) -> Optional[bytes]:
        """Retrieves cleaned CSV file bytes, checking S3 then local."""
        cleaned_filename = f"cleaned_{filename}"
        s3_key = f"cleaned/{job_id}/{cleaned_filename}"

        # Try Floci S3 first
        try:
            s3 = floci_client.get_s3_client()
            response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
            return response["Body"].read()
        except Exception:
            pass

        # Try local backup
        local_file = self.local_dir / "cleaned" / job_id / cleaned_filename
        if local_file.exists():
            return local_file.read_bytes()

        return None

    def get_report(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves audit report dict, checking S3 then local."""
        s3_key = f"reports/{job_id}/audit_report.json"

        # Try Floci S3 first
        try:
            s3 = floci_client.get_s3_client()
            response = s3.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
            return json.loads(response["Body"].read().decode("utf-8"))
        except Exception:
            pass

        # Try local backup
        local_file = self.local_dir / "reports" / job_id / "audit_report.json"
        if local_file.exists():
            try:
                return json.loads(local_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        return None

    def delete_job_files(self, job_id: str) -> None:
        """Deletes files related to a job in Floci S3 and local storage."""
        import shutil
        for sub in ["raw", "cleaned", "reports"]:
            p = self.local_dir / sub / job_id
            if p.exists():
                shutil.rmtree(p, ignore_errors=True)

        try:
            s3 = floci_client.get_s3_client()
            for prefix in [f"raw/{job_id}/", f"cleaned/{job_id}/", f"reports/{job_id}/"]:
                res = s3.list_objects_v2(Bucket=settings.S3_BUCKET_NAME, Prefix=prefix)
                objects = [{"Key": obj["Key"]} for obj in res.get("Contents", [])]
                if objects:
                    s3.delete_objects(
                        Bucket=settings.S3_BUCKET_NAME,
                        Delete={"Objects": objects},
                    )
        except Exception:
            pass


storage_service = StorageService()
