"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # ── App ──────────────────────────────────────────────────────────────────
    app_name: str = "ASTRA-IDE Backend"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./astra.db"

    # ── Auth / JWT ───────────────────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production-please"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    # ── Google OAuth (Sign in with Google) ───────────────────────────────────
    # Create an OAuth 2.0 Client ID (type "Web application") in Google Cloud
    # Console and set these in backend/.env. Authorized redirect URI to register:
    #   http://localhost:3000/api/auth/google/callback   (dev, via Next proxy)
    google_client_id:     Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri:  str = "http://localhost:3000/api/auth/google/callback"
    frontend_url:         str = "http://localhost:3000"

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── External services ────────────────────────────────────────────────────
    collab_ws_url: str = "ws://localhost:1234"
    scheduler_grpc_url: str = "localhost:50051"
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: str = "admin"
    minio_secret_key: str = "admin12345"

    # ── Carbon / energy API (electricityMaps) ────────────────────────────────
    electricity_maps_token: Optional[str] = None    # set in .env, never commit
    electricity_maps_zone:  str = "DK-DK1"          # sandbox key only works for DK-DK1
    electricity_maps_url:   str = "https://api.electricitymap.org/v3"

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
