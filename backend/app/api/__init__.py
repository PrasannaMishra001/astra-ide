from fastapi import APIRouter

from app.api import auth, workspaces, carbon

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(workspaces.router)
api_router.include_router(carbon.router)
