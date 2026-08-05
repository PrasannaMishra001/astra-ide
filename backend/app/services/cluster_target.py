"""Resolve a workspace's cluster to the connection details needed to act on it.

CP-PPO writes a `cluster_id` onto each workspace. Everything downstream — creating
the pod, opening a terminal, reading files — needs to turn that id into "which
kubeconfig do I talk to, and is that cluster somewhere else?". This module is the
single place that mapping lives, so no caller has to guess.

The registry itself is `cluster_state.load_cluster_registry()`; we only add the
lookup, the geo coordinates the public globe needs, and the local/remote
distinction that decides whether file I/O can use the fast local path.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

from app.services import cluster_state

logger = logging.getLogger(__name__)

# Where the backend itself runs. Workspaces on this cluster use the local Docker
# path (fast, no network hop); everything else goes over the Kubernetes API.
HOME_CLUSTER_ID = os.getenv("ASTRA_HOME_CLUSTER", "mumbai")

# Fallback coordinates for the regions we run in, used only when the registry
# entry has no lat/lon. Approximate city centres of the GCP region, which is all
# a globe marker needs.
_ZONE_COORDS: dict[str, tuple[float, float]] = {
    "IN-WE":        (19.08, 72.88),    # Mumbai / asia-south1
    "BE":           (50.85, 4.35),     # Belgium / europe-west1
    "US-MIDA-PJM":  (39.04, -77.49),   # N. Virginia (Ashburn) / us-east4
    "US-MIDW-MISO": (41.26, -95.94),   # Iowa / us-central1
}


@dataclass(frozen=True)
class Target:
    id:         str
    location:   str
    zone:       str
    kubeconfig: Optional[str]
    lat:        Optional[float]
    lon:        Optional[float]

    @property
    def is_home(self) -> bool:
        return self.id == HOME_CLUSTER_ID

    @property
    def is_remote(self) -> bool:
        """True when acting on this cluster means a call to another region."""
        return not self.is_home and bool(self.kubeconfig)


def _to_target(entry: dict) -> Target:
    zone = entry.get("zone", "")
    lat, lon = entry.get("lat"), entry.get("lon")
    if lat is None or lon is None:
        lat, lon = _ZONE_COORDS.get(zone, (None, None))
    return Target(
        id=entry["id"],
        location=entry.get("location", entry["id"]),
        zone=zone,
        kubeconfig=entry.get("kubeconfig"),
        lat=lat, lon=lon,
    )


def all_targets() -> list[Target]:
    return [_to_target(e) for e in cluster_state.load_cluster_registry()]


def resolve(cluster_id: Optional[str]) -> Optional[Target]:
    """Target for a cluster id, or None if it is not in the registry.

    An unknown id is not an error worth failing a request over — the workspace
    may predate a registry change — so callers fall back to `home()`.
    """
    if not cluster_id:
        return None
    for t in all_targets():
        if t.id == cluster_id:
            return t
    return None


def home() -> Target:
    """The cluster the backend runs on. First registry entry if the configured
    home id is absent, so a single-cluster deployment still works."""
    targets = all_targets()
    for t in targets:
        if t.id == HOME_CLUSTER_ID:
            return t
    if targets:
        return targets[0]
    return Target(id="cluster-local", location="on-cluster", zone="",
                  kubeconfig=None, lat=None, lon=None)


def for_workspace(ws) -> Target:
    """Where this workspace should run. Falls back to home for unplaced or
    stale workspaces so a missing/renamed cluster can never strand one."""
    t = resolve(getattr(ws, "cluster_id", None))
    if t is None:
        cid = getattr(ws, "cluster_id", None)
        if cid:
            logger.warning("workspace %s references unknown cluster %r; using home",
                           getattr(ws, "id", "?"), cid)
        return home()
    return t
