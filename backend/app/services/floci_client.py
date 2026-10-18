import logging
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, EndpointConnectionError
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger("fileflow.floci")

# Fast timeout config to prevent requests from hanging if Floci is temporarily stopped
FAST_BOTO_CONFIG = Config(
    connect_timeout=0.5,
    read_timeout=0.5,
    retries={"max_attempts": 1},
)


class FlociClientManager:
    """
    Manages connections to the local AWS emulator (Floci).
    
    IMPORTANT:
    This class strictly DOES NOT create any AWS resources (buckets, queues, or tables).
    The user creates all required AWS resources manually in Floci.
    This manager only provides client access to interact with the pre-existing resources.
    """

    def __init__(self):
        self._s3_client: Optional[Any] = None
        self._sqs_client: Optional[Any] = None
        self._dynamodb_resource: Optional[Any] = None

    def get_s3_client(self):
        """Returns boto3 S3 client targeted at Floci."""
        if self._s3_client is None:
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=settings.FLOCI_ENDPOINT_URL,
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=FAST_BOTO_CONFIG,
            )
        return self._s3_client

    def get_sqs_client(self):
        """Returns boto3 SQS client targeted at Floci."""
        if self._sqs_client is None:
            self._sqs_client = boto3.client(
                "sqs",
                endpoint_url=settings.FLOCI_ENDPOINT_URL,
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=FAST_BOTO_CONFIG,
            )
        return self._sqs_client

    def get_dynamodb_resource(self):
        """Returns boto3 DynamoDB resource targeted at Floci."""
        if self._dynamodb_resource is None:
            self._dynamodb_resource = boto3.resource(
                "dynamodb",
                endpoint_url=settings.FLOCI_ENDPOINT_URL,
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=FAST_BOTO_CONFIG,
            )
        return self._dynamodb_resource

    def check_floci_health(self) -> Dict[str, Any]:
        """
        Inspects whether Floci is reachable and checks access to user-created resources.
        Does NOT attempt to create any missing resources.
        """
        s3_ok = False
        sqs_ok = False
        dynamodb_ok = False
        overall_connected = False

        # 1. Check S3 bucket access
        try:
            s3 = self.get_s3_client()
            s3.head_bucket(Bucket=settings.S3_BUCKET_NAME)
            s3_ok = True
            overall_connected = True
        except (ClientError, EndpointConnectionError, Exception) as e:
            logger.debug(f"Floci S3 bucket '{settings.S3_BUCKET_NAME}' check: {e}")

        # 2. Check SQS queue access
        try:
            sqs = self.get_sqs_client()
            sqs.get_queue_url(QueueName=settings.SQS_QUEUE_NAME)
            sqs_ok = True
            overall_connected = True
        except (ClientError, EndpointConnectionError, Exception) as e:
            logger.debug(f"Floci SQS queue '{settings.SQS_QUEUE_NAME}' check: {e}")

        # 3. Check DynamoDB table access
        try:
            db = self.get_dynamodb_resource()
            table = db.Table(settings.DYNAMODB_TABLE_NAME)
            table.load()
            dynamodb_ok = True
            overall_connected = True
        except (ClientError, EndpointConnectionError, Exception) as e:
            logger.debug(f"Floci DynamoDB table '{settings.DYNAMODB_TABLE_NAME}' check: {e}")

        return {
            "connected": overall_connected,
            "endpoint": settings.FLOCI_ENDPOINT_URL,
            "resources": {
                "s3Bucket": {
                    "name": settings.S3_BUCKET_NAME,
                    "accessible": s3_ok,
                },
                "sqsQueue": {
                    "name": settings.SQS_QUEUE_NAME,
                    "accessible": sqs_ok,
                },
                "dynamoDbTable": {
                    "name": settings.DYNAMODB_TABLE_NAME,
                    "accessible": dynamodb_ok,
                },
            },
        }


floci_client = FlociClientManager()
