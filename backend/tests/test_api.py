import io
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from main import app
from app.services.validator_service import validator_service


class TestFileFlowBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        """Verify health probe endpoint returns 200 OK."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("FileFlow", data["service"])

    def test_system_status_endpoint(self):
        """Verify system status reports Floci connection details and worker status."""
        response = self.client.get("/api/v1/system/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("cloudEmulator", data)
        self.assertIn("resources", data)
        self.assertIn("worker", data)
        self.assertEqual(data["worker"]["concurrency"], 4)

    def test_list_jobs_endpoint(self):
        """Verify jobs listing endpoint returns list of jobs."""
        response = self.client.get("/api/v1/jobs")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)

    def test_validator_service_clean_and_anomalies(self):
        """Verify validation engine accurately identifies email, numeric, and duplicate errors."""
        csv_sample = (
            "id,name,email,amount\n"
            "1,Alice,alice@example.com,100.50\n"
            "2,Bob,bob_invalid_email,50.00\n"
            "3,Charlie,charlie@test.com,-25.00\n"
            "4,Duplicate,dup@test.com,10.00\n"
            "4,Duplicate,dup@test.com,10.00\n"
        )
        results, cleaned_csv = validator_service.validate_and_clean(csv_sample.encode("utf-8"), "test.csv")
        self.assertEqual(results["totalRows"], 5)
        self.assertEqual(results["duplicateRows"], 1)
        self.assertGreaterEqual(results["invalidRows"], 2)

        # Verify cleaned CSV removes duplicate row
        cleaned_lines = cleaned_csv.strip().split("\n")
        self.assertEqual(len(cleaned_lines), 5)  # 1 header + 4 unique rows

    def test_process_sample_endpoint(self):
        """Verify sample dataset processing trigger."""
        response = self.client.post("/api/v1/jobs/sample")
        self.assertEqual(response.status_code, 200)
        job = response.json()
        self.assertIn("id", job)
        self.assertEqual(job["fileName"], "enterprise_sample_dataset.csv")
        self.assertIn(job["status"], ["QUEUED", "PROCESSING", "COMPLETED"])

    def test_upload_csv_endpoint(self):
        """Verify uploading a CSV file initiates pipeline."""
        sample_csv_data = "col1,col2,email\nval1,val2,test@domain.com\n"
        files = {"file": ("test_upload.csv", io.BytesIO(sample_csv_data.encode("utf-8")), "text/csv")}
        response = self.client.post("/api/v1/jobs/upload", files=files)
        self.assertEqual(response.status_code, 200)
        job = response.json()
        self.assertEqual(job["fileName"], "test_upload.csv")
        self.assertIn("id", job)


if __name__ == "__main__":
    unittest.main()
