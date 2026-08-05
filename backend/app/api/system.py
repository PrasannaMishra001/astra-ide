"""System status — surfaces which optional infra backends are live."""
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings
from app.services import cluster_state, cluster_target, object_store
from app.services.cache import get_cache

router = APIRouter(prefix="/system", tags=["system"])
settings = get_settings()


@router.get("/status")
def status() -> dict:
    """Which tech-stack backends are wired/live right now (for ops + the report)."""
    return {
        "environment":   settings.environment,
        "database":      settings.database_url.split(":")[0],   # sqlite | postgresql
        "cache_backend": get_cache().backend,                   # redis | memory
        "object_store":  "minio" if object_store.is_available() else "unavailable",
        "metrics":       "/metrics (prometheus)",
        "carbon_api":    "configured" if settings.electricity_maps_token else "fallback",
        "google_oauth":  "configured" if settings.google_client_id else "unconfigured",
    }


class PublicCluster(BaseModel):
    id:            str
    location:      str
    lat:           Optional[float] = None
    lon:           Optional[float] = None
    carbon_gco2:   float = 0.0
    carbon_source: str = "unknown"
    healthy:       bool = False


class PublicTopology(BaseModel):
    clusters:  List[PublicCluster]
    federated: bool
    controller: Optional[str] = None


@router.get("/topology", response_model=PublicTopology)
def public_topology() -> PublicTopology:
    """Where ASTRA actually runs — for the globe on the logged-out homepage.

    Deliberately unauthenticated, and deliberately narrow: region name, grid
    carbon and a health flag only. No node names, capacities, utilisation or
    workspace counts, so nothing here helps someone target the deployment.

    The homepage used to hardcode four fictional regions; reading this instead
    means a stopped cluster shows as unhealthy rather than as a green dot.
    """
    live = cluster_state.snapshot()
    out: List[PublicCluster] = []
    for t in cluster_target.all_targets():
        c = live.get(t.id) or {}
        nodes = c.get("nodes") or []
        out.append(PublicCluster(
            id=t.id,
            location=c.get("location") or t.location,
            lat=t.lat, lon=t.lon,
            carbon_gco2=float(c.get("carbon_gco2") or 0.0),
            carbon_source=c.get("carbon_source", "unknown"),
            # Healthy means the cluster answered our last telemetry read with at
            # least one node; an unreachable cluster drops out of the snapshot.
            healthy=bool(nodes),
        ))
    fed = cluster_state.federation_status()
    return PublicTopology(
        clusters=out,
        federated=bool(fed.get("enabled")),
        controller=fed.get("controller"),
    )
