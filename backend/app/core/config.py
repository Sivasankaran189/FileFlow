import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "FileFlow"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Local AWS Emulator (Floci) Settings
    # NOTE: Resources are created manually by the user in Floci.
    # The application does NOT use boto3 to create AWS resources.
    FLOCI_ENDPOINT_URL: str = os.getenv("FLOCI_ENDPOINT_URL", "http://localhost:4566")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "test")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "test")

    # Target resource names in Floci
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "fileflow-bucket")
    SQS_QUEUE_NAME: str = os.getenv("SQS_QUEUE_NAME", "fileflow-jobs-queue")
    DYNAMODB_TABLE_NAME: str = os.getenv("DYNAMODB_TABLE_NAME", "fileflow-jobs")

    # Local fallback storage path
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", "storage"))

    # CORS Configuration for Frontend
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "*",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
