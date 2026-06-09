"""ASTRA-IDE FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import get_settings
from app.core.metrics import PrometheusMiddleware, metrics_response
from app.db.session import Base, engine

# Import models to register them with SQLAlchemy's metadata
from app.models import User, Workspace, WorkspaceMember, SchedulerEvent  # noqa: F401
from app.services import telemetry_loop

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (for dev — use Alembic in production)
    Base.metadata.create_all(bind=engine)
    # Kick off the background telemetry/event simulator
    await telemetry_loop.start()
    try:
        yield
    finally:
        await telemetry_loop.stop()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
    openapi_url=f"{settings.api_prefix}/openapi.json",
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrometheusMiddleware)


@app.get("/healthz", tags=["health"])
def health_check():
    return {"status": "ok", "service": settings.app_name, "env": settings.environment}


@app.get("/metrics", tags=["monitoring"])
def metrics():
    """Prometheus scrape endpoint (kube-prometheus-stack / ServiceMonitor)."""
    # Refresh the queue-depth gauge KEDA scales on, at scrape time.
    try:
        from app.core.metrics import WORKSPACE_PENDING_QUEUE
        from app.db.session import SessionLocal
        from app.models import Workspace
        db = SessionLocal()
        try:
            pending = db.query(Workspace).filter(Workspace.status == "PENDING").count()
            WORKSPACE_PENDING_QUEUE.set(pending)
        finally:
            db.close()
    except Exception:
        pass
    return metrics_response()


app.include_router(api_router, prefix=settings.api_prefix)
