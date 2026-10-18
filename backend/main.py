import sys
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import time
import logging
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from app.core.config import settings
from app.api.v1.api import api_router
from app.services.floci_client import floci_client

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fileflow")

# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FileFlow: High-Performance Distributed CSV Processing & Quality Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Set up CORS so the React frontend can communicate seamlessly with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Metrics
REQUEST_COUNT = Counter(
    "fileflow_http_requests_total",
    "Total HTTP requests received",
    ["method", "endpoint", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "fileflow_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["endpoint"],
)


@app.middleware("http")
async def monitor_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    # Record Prometheus metrics (ignore /metrics scrape to prevent noise)
    if request.url.path != "/metrics":
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status_code=response.status_code,
        ).inc()
        REQUEST_LATENCY.labels(endpoint=request.url.path).observe(duration)

    return response


@app.on_event("startup")
async def on_startup():
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Checking Floci emulator at {settings.FLOCI_ENDPOINT_URL}...")
    floci_info = floci_client.check_floci_health()
    if floci_info["connected"]:
        logger.info("Successfully connected to Floci AWS emulator!")
        logger.info(f"Target Floci resources: S3='{settings.S3_BUCKET_NAME}', SQS='{settings.SQS_QUEUE_NAME}', DynamoDB='{settings.DYNAMODB_TABLE_NAME}'")
    else:
        logger.info("Floci emulator not fully accessible yet. Operating in resilient local mode with automatic sync.")


# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["General"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "api_v1_url": settings.API_V1_STR,
    }


@app.get("/health", tags=["Monitoring"])
async def health_check():
    """Kubernetes liveness and readiness probe endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": "cloud-simulated (Floci)",
    }


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus metrics scraping endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
