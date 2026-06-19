"""
PF-MPPO inference service for live scheduling decisions.

Loads the trained PF-MPPO model and provides placement decisions for workspaces.
Falls back gracefully if model is unavailable or inference fails.
"""
from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

from app.models import Workspace
from app.services import cluster_state
from app.services.scheduler_service import PlacementDecision

logger = logging.getLogger(__name__)

# Lazy imports for ML dependencies
_torch = None
_network_cls = None
_initialized = False


def _ensure_imports():
    global _torch, _network_cls, _initialized
    if _initialized:
        return
    _initialized = True
    try:
        import torch
        _torch = torch
        sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
        from ml.scheduler.pfmppo.network import PFMPPONetwork
        _network_cls = PFMPPONetwork
    except ImportError as e:
        logger.warning("PF-MPPO dependencies not available: %s", e)


class PFMPPOInferenceService:
    """
    Singleton inference service for PF-MPPO scheduling.

    Thread-safe: uses a lock around model inference.
    """

    def __init__(self, model_path: str, k_pairs: int = 10):
        _ensure_imports()
        self._lock = threading.Lock()
        self.k_pairs = k_pairs
        self.network = None
        self._load_model(model_path)

    def _load_model(self, model_path: str) -> None:
        """Load the trained PF-MPPO model."""
        if _torch is None or _network_cls is None:
            logger.error("PyTorch or PFMPPONetwork not available")
            return

        path = Path(model_path)
        if not path.exists():
            logger.error("PF-MPPO model not found: %s", path)
            return

        try:
            input_dim = self.k_pairs * 10
            self.network = _network_cls(input_dim=input_dim, k_pairs=self.k_pairs)
            checkpoint = _torch.load(str(path), map_location="cpu", weights_only=True)
            self.network.load_state_dict(checkpoint["network"])
            self.network.eval()
            logger.info("PF-MPPO model loaded from %s", path)
        except Exception as e:
            logger.error("Failed to load PF-MPPO model: %s", e)
            self.network = None

    def decide_placement(self, workspace: Workspace) -> Optional[PlacementDecision]:
        """
        Use PF-MPPO model to decide workspace placement.

        Returns PlacementDecision or None if inference fails (caller should fallback).
        """
        if self.network is None or _torch is None:
            return None

        try:
            with self._lock:
                return self._infer(workspace)
        except Exception as e:
            logger.warning("PF-MPPO inference error: %s", e)
            return None

    def _infer(self, workspace: Workspace) -> Optional[PlacementDecision]:
        """Run model inference."""
        # Build admissible pairs from live cluster state
        nodes = cluster_state.all_nodes()
        clusters = cluster_state.all_clusters()
        cluster_map = {c.id: c for c in clusters}

        # Filter nodes that support the workspace's sandbox tier
        candidates: List[Tuple[str, cluster_state.Node]] = []
        for node in nodes:
            if workspace.sandbox_tier in node.sandboxes:
                candidates.append((node.cluster_id, node))

        if not candidates:
            return None

        # Build state vector (trivial single-task DAG: no predecessors/successors)
        state = np.zeros(self.k_pairs * 10, dtype=np.float32)

        for i, (cid, node) in enumerate(candidates[:self.k_pairs]):
            offset = i * 10
            avail_cpu = node.cpu_cap * (1.0 - node.cpu_util)
            avail_mem = node.mem_cap * (1.0 - node.memory_util)
            avail_disk = node.disk_cap * 0.8  # assume 80% disk available

            state[offset + 0] = avail_cpu - workspace.cpu_request
            state[offset + 1] = (avail_mem - workspace.memory_request) / 1000.0
            state[offset + 2] = (avail_disk - 1024.0) / 10000.0  # default disk req
            state[offset + 3] = node.bandwidth_mbps / 1000.0
            state[offset + 4] = node.proc_rate_mbps / 100.0
            state[offset + 5] = 1.0 / 30.0   # trivial task duration estimate
            state[offset + 6] = 0.1           # minimal data size
            state[offset + 7] = 0.0           # succ_nums = 0 (single task)
            state[offset + 8] = 0.0           # desc_nums = 0
            state[offset + 9] = 0.0           # task_layers = 0

        # Valid action mask
        valid_mask = np.zeros(self.k_pairs, dtype=np.float32)
        for i in range(min(len(candidates), self.k_pairs)):
            valid_mask[i] = 1.0

        # Inference
        state_t = _torch.tensor(state, dtype=_torch.float32).unsqueeze(0)
        mask_t = _torch.tensor(valid_mask, dtype=_torch.float32).unsqueeze(0)

        with _torch.no_grad():
            action_probs, _ = self.network(state_t, mask_t)

        action = int(action_probs.squeeze(0).argmax().item())
        action = min(action, len(candidates) - 1)

        chosen_cluster_id, chosen_node = candidates[action]
        score = float(action_probs.squeeze(0)[action].item())

        return PlacementDecision(
            cluster_id=chosen_cluster_id,
            node_name=chosen_node.name,
            sandbox_tier=workspace.sandbox_tier,
            score=score,
            reasoning=f"PF-MPPO action={action} prob={score:.3f}",
        )


# ── Singleton ────────────────────────────────────────────────────────────────

_instance: Optional[PFMPPOInferenceService] = None
_instance_lock = threading.Lock()


def get_inference_service() -> Optional[PFMPPOInferenceService]:
    """Get or create the PF-MPPO inference service singleton."""
    global _instance
    if _instance is not None:
        return _instance

    with _instance_lock:
        if _instance is not None:
            return _instance

        from app.core.config import get_settings
        settings = get_settings()

        if not settings.pfmppo_model_path:
            return None

        _instance = PFMPPOInferenceService(
            model_path=settings.pfmppo_model_path,
            k_pairs=settings.pfmppo_k_pairs,
        )
        if _instance.network is None:
            _instance = None
        return _instance
