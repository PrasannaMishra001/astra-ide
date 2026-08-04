"""Pydantic schemas for the events + metrics APIs."""
from datetime import datetime, timezone
from typing import List, Dict, Optional
from pydantic import BaseModel, field_serializer


class EventOut(BaseModel):
    id:           int
    timestamp:    datetime
    kind:         str
    title:        str
    detail:       str
    workspace_id: int
    cluster_id:   str
    node_name:    str

    # DB stores naive UTC; serialize timezone-aware so browsers in any locale
    # compute correct relative times (was rendering "5h ago" in IST).
    @field_serializer("timestamp")
    def _utc(self, v: datetime) -> str:
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()

    class Config:
        from_attributes = True


class EventList(BaseModel):
    total: int
    items: List[EventOut]


class NodeMetrics(BaseModel):
    cluster_id:    str
    node_name:     str
    cpu_util:      float       # 0..1
    memory_util:   float       # 0..1
    network_kbps:  float
    run_queue_len: float
    active_pods:   int


class ClusterMetrics(BaseModel):
    cluster_id:   str
    location:     str
    carbon_gco2:  float
    # "api" = live reading, "fallback" = published historical average for the
    # zone, "unknown" = not fetched yet. Lets the UI avoid presenting an
    # estimate as a measurement.
    carbon_source: str = "unknown"
    nodes:        List[NodeMetrics]
    total_pods:   int


class FederationStatus(BaseModel):
    """Whether a real federation control plane is running, so the dashboard can
    only claim federation behaviour when it is actually there."""
    enabled:    bool = False
    controller: Optional[str] = None      # e.g. "karmada"
    members:    int = 0


class MetricsSnapshot(BaseModel):
    timestamp:  datetime
    clusters:   List[ClusterMetrics]
    federation: FederationStatus = FederationStatus()


class BenchmarkRow(BaseModel):
    algorithm:           str           # ppo / round_robin / random / fifo / least_loaded
    avg_latency_ms:      float
    p95_latency_ms:      float
    utilization_pct:     float
    balance_score:       float         # 0..1, higher = more balanced
    energy_kwh:          float
    sla_violations:      int


class BenchmarkReport(BaseModel):
    description: str
    rows:        List[BenchmarkRow]
    metadata:    Dict[str, str]
