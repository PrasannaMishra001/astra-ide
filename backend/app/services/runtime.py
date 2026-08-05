"""One entry point for "do something to this workspace's sandbox".

Two backends implement the same operations:

  * `container_service` — a Docker container on the backend's own host. Fast
    (no network hop), but only ever local.
  * `pod_service`       — a Pod on whichever cluster CP-PPO chose, reached over
    the Kubernetes API. Works across regions; costs a round trip.

Callers should not care which one is in play, so they call this module and it
picks. The rule is simple: use pods when Kubernetes workspaces are enabled and
reachable, otherwise fall back to Docker. That fallback is deliberate — if the
federation is down, workspaces must still start locally rather than fail.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.services import cluster_target, container_service, pod_service

logger = logging.getLogger(__name__)


def backend_for(ws) -> object:
    """Backend that should run this workspace."""
    if pod_service.available():
        return pod_service
    return container_service


def backend_for_id(ws_id: int) -> object:
    """Backend that owns an already-running workspace.

    Checked in the same order as `backend_for`, but a workspace started under
    the other backend must still be reachable — otherwise a config change would
    orphan running sessions — so we fall back to whichever one actually has it.
    """
    if pod_service.available():
        if pod_service.is_running(ws_id):
            return pod_service
        if container_service.is_running(ws_id):
            return container_service
        return pod_service
    return container_service


def available() -> bool:
    return pod_service.available() or container_service.available()


def is_running(ws_id: int) -> bool:
    return backend_for_id(ws_id).is_running(ws_id)


def start(ws) -> bool:
    b = backend_for(ws)
    ok = b.start(ws)
    if not ok and b is pod_service and container_service.available():
        logger.warning("pod start failed for workspace %s; falling back to local container", ws.id)
        return container_service.start(ws)
    return ok


def stop(ws_id: int) -> None:
    # Stop both: a workspace may have been started under the other backend
    # before a config change, and a leaked sandbox is worse than a no-op.
    for b in (pod_service, container_service):
        try:
            if b.available():
                b.stop(ws_id)
        except Exception:
            pass


def exec_argv(ws_id: int) -> list[str]:
    return backend_for_id(ws_id).exec_argv(ws_id)


def stats(ws_id: int) -> Optional[dict]:
    return backend_for_id(ws_id).stats(ws_id)


def logs(ws_id: int, tail: int = 50) -> list[str]:
    return backend_for_id(ws_id).logs(ws_id, tail)


def list_listening_ports(ws_id: int) -> list[int]:
    return backend_for_id(ws_id).list_listening_ports(ws_id)


def fetch_port(ws_id: int, port: int, path: str):
    return backend_for_id(ws_id).fetch_port(ws_id, port, path)


def location_of(ws) -> str:
    """Human-readable region a workspace runs in, for the UI."""
    return cluster_target.for_workspace(ws).location


def is_remote(ws) -> bool:
    """True when this workspace runs in a different region from the backend."""
    return pod_service.available() and cluster_target.for_workspace(ws).is_remote
