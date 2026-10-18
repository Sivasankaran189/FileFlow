from fastapi import APIRouter
from app.api.v1.endpoints import jobs, system

api_router = APIRouter()
api_router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
