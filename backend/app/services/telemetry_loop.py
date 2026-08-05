"""
Background telemetry loop — runs as an asyncio task started from the FastAPI
lifespan. Every few seconds it:

  1. Reads live per-node metrics from every registered cluster (metrics-server),
     falling back to an in-memory drift only when no cluster is reachable
  2. Records those readings, and per-zone grid carbon, into the SchedulerEvent
     table for the activity feed
  3. Periodically refreshes carbon intensity from the electricityMaps API
  4. Prunes the event log so it stays small (keeps the most recent 500)

The feed carries only measurements this deployment actually takes. Tetragon
syscall capture, the LSTM pre-warmer and the intrusion detector are evaluated
offline in `benchmarks/` and are NOT running here, so this loop must not emit
events attributed to them.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Optional

from app.services import cluster_state
from app.services import events_service
from app.services.carbon_service import get_carbon_service
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

# How often each kind of loop fires
TICK_TELEMETRY_S       = 4
TICK_EVENT_EMIT_S      = 5
TICK_CARBON_REFRESH_S  = 600   # 10 min — stays under electricityMaps quota
TICK_PRUNE_S           = 300

_rng = random.Random(42)


async def telemetry_main_loop() -> None:
    """Drives all sub-loops. Cancels safely when the FastAPI app shuts down."""
    logger.info("Telemetry loop starting")
    try:
        events_service.record(
            kind="system", title="ASTRA-IDE scheduler online",
            detail="CP-PPO policy loaded |cluster telemetry live |activity stream live",
        )
    except Exception as e:
        logger.warning("Could not write startup event: %s", e)

    # Prime the state before the loop starts. Without this the cluster list is
    # empty and every carbon figure reads 0 until the first refresh interval
    # elapses, which looks like a broken dashboard after each restart.
    try:
        if cluster_state._use_k8s():
            await asyncio.to_thread(cluster_state.refresh_from_kubernetes)
        await asyncio.to_thread(_refresh_carbon)
    except Exception as e:
        logger.warning("Initial telemetry priming failed: %s", e)

    last_drift  = 0.0
    last_event  = 0.0
    last_carbon = 0.0
    last_prune  = 0.0
    t = 0.0

    while True:
        await asyncio.sleep(1)
        t += 1.0

        try:
            if t - last_drift > TICK_TELEMETRY_S:
                # On a real cluster (ASTRA_USE_K8S_METRICS=1) read live node metrics;
                # otherwise drift the in-memory simulator.
                #
                # Off the event loop: these are blocking HTTP calls to every
                # member cluster, and a stopped region black-holes them. Run
                # inline, one unreachable cluster froze the whole app for the
                # length of the read (45 s measured with Belgium powered off).
                if not (cluster_state._use_k8s()
                        and await asyncio.to_thread(cluster_state.refresh_from_kubernetes)):
                    cluster_state.tick_telemetry()
                last_drift = t

            if t - last_event > TICK_EVENT_EMIT_S:
                _emit_node_event()
                last_event = t

            if t - last_carbon > TICK_CARBON_REFRESH_S:
                await asyncio.to_thread(_refresh_carbon)     # outbound HTTP per zone
                last_carbon = t

            if t - last_prune > TICK_PRUNE_S:
                _prune()
                last_prune = t
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("Telemetry loop tick failed: %s", e)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _emit_node_event() -> None:
    """Report one node's current telemetry into the activity feed.

    Only things we actually measure. This used to also emit "LSTM prewarmer |
    scoring active users" with a random probability, a Yjs awareness flush with
    a random client count, and label node metrics as `ebpf` — none of which were
    real: no prewarmer or Tetragon collector runs in this deployment. Inventing
    plausible lines for components that do not exist is worse than a quiet feed,
    because it is indistinguishable from the real entries beside it.

    What remains is genuine: node CPU/memory/run-queue/network read from
    metrics-server, and grid carbon read per zone.
    """
    nodes = cluster_state.all_nodes()
    if not nodes:
        return
    node = _rng.choice(nodes)
    cluster = cluster_state.get_cluster(node.cluster_id)
    if cluster is None:
        return

    if _rng.random() < 0.75:
        events_service.record(
            kind="node",
            title=f"node telemetry |{node.name}",
            detail=(
                f"cpu={node.cpu_util:.2f} mem={node.memory_util:.2f} "
                f"runq={node.run_queue_len:.1f} net={node.network_kbps:.0f}KiB/s"
            ),
            cluster_id=cluster.id, node_name=node.name,
        )
    else:
        source = getattr(cluster, "carbon_source", "unknown")
        label = "live" if source == "api" else "historical avg"
        events_service.record(
            kind="carbon",
            title=f"Carbon read |{cluster.zone}",
            detail=(f"{cluster.carbon_gco2:.0f} gCO2/kWh |"
                    f"{_carbon_grade(cluster.carbon_gco2)} |{label}"),
            cluster_id=cluster.id,
        )


def _refresh_carbon() -> None:
    """Hit electricityMaps once per zone and update the cached cluster state."""
    svc = get_carbon_service()
    for cluster in cluster_state.all_clusters():
        try:
            reading = svc.get_intensity(cluster.zone)
            # Record where the number came from so the dashboard can label a
            # historical average as such instead of showing it as a live reading.
            cluster_state.set_carbon_intensity(
                cluster.id, reading.carbon_intensity, getattr(reading, "source", "api"))
        except Exception as e:
            logger.warning("Carbon refresh failed for %s: %s", cluster.zone, e)


def _prune() -> None:
    db = SessionLocal()
    try:
        deleted = events_service.prune_old(db, keep_last=500)
        if deleted:
            logger.info("Pruned %d old events", deleted)
    finally:
        db.close()


def _carbon_grade(g: float) -> str:
    if g < 100:  return "clean"
    if g < 300:  return "moderate"
    if g < 600:  return "fossil-heavy"
    return "high carbon"


# ── Lifespan helpers (called from app.main) ─────────────────────────────────

_task: Optional[asyncio.Task] = None


async def start() -> None:
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(telemetry_main_loop())


async def stop() -> None:
    global _task
    if _task is not None and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
    _task = None
