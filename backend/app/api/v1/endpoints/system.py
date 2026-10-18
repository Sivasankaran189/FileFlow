from fastapi import APIRouter
from app.services.floci_client import floci_client
from app.services.storage_service import storage_service
from app.core.config import settings

router = APIRouter()


@router.get("/status")
async def get_system_status():
    """Returns connectivity and operational status of all platform services and Floci resources."""
    floci_info = floci_client.check_floci_health()
    cloud_active = floci_info["connected"]

    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "cloudEmulator": {
            "endpoint": settings.FLOCI_ENDPOINT_URL,
            "connected": cloud_active,
            "mode": "AWS-Emulated (Floci)" if cloud_active else "Resilient Local Mode",
            "health": floci_info["resources"],
        },
        "resources": {
            "s3Bucket": settings.S3_BUCKET_NAME,
            "sqsQueue": settings.SQS_QUEUE_NAME,
            "dynamoDbTable": settings.DYNAMODB_TABLE_NAME,
        },
        "worker": {
            "engine": "Concurrent ThreadPool Worker",
            "concurrency": 4,
            "status": "ready",
        },
    }
