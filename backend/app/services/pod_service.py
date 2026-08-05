"""Per-workspace Pods on whichever cluster CP-PPO picked — including remote ones.

This is the cross-region twin of `container_service`. It exposes the SAME
interface (available / is_running / start / stop / exec_argv / stats / logs /
list_listening_ports / fetch_port) so `runtime.py` can dispatch between them
without any caller knowing which one it got.

Everything goes through `kubectl --kubeconfig <the target cluster's>`, which is
what makes a workspace in Belgium usable from the Mumbai backend: the terminal
`kubectl exec`s into the remote pod exactly as it used to `docker exec` into a
local container, and because `exec_argv()` still returns a plain argv list the
terminal transport did not have to change at all.

The cost is honest: every operation is now a round trip to that region, so a
remote workspace echoes keystrokes in ~150 ms rather than ~20 ms. Workspaces on
the home cluster keep using the local Docker path.
"""
from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from typing import Optional

from app.services import cluster_target, container_service, sandbox_runtime
from app.services.cluster_target import Target

logger = logging.getLogger(__name__)

NAMESPACE = sandbox_runtime.NAMESPACE
ENABLED = os.getenv("ASTRA_K8S_WORKSPACES", "0") == "1"

# Reuse the same language→image table the Docker path uses, so a workspace gets
# the same toolchain wherever it lands.
image_for = container_service.image_for


def _name(ws_id: int) -> str:
    return f"astra-ws-{ws_id}"


def available() -> bool:
    return ENABLED and shutil.which("kubectl") is not None


# ── Target resolution ────────────────────────────────────────────────────────
# is_running/stats/logs take only a workspace id, but we need to know which
# cluster to ask. The mapping changes only when a workspace is (re)placed, so a
# small cache keeps polling endpoints off the database.

_TARGET_CACHE: dict[int, str] = {}


def remember(ws) -> None:
    """Record where a workspace was placed, so later id-only calls find it."""
    cid = getattr(ws, "cluster_id", None)
    if cid:
        _TARGET_CACHE[int(ws.id)] = cid


def forget(ws_id: int) -> None:
    _TARGET_CACHE.pop(int(ws_id), None)


def _target_for_id(ws_id: int) -> Optional[Target]:
    cid = _TARGET_CACHE.get(int(ws_id))
    if cid is None:
        try:
            from app.db.session import SessionLocal
            from app.models import Workspace
            db = SessionLocal()
            try:
                cid = db.query(Workspace.cluster_id).filter(
                    Workspace.id == ws_id).scalar()
            finally:
                db.close()
        except Exception as e:
            logger.warning("could not resolve cluster for workspace %s: %s", ws_id, e)
            return None
        if cid:
            _TARGET_CACHE[int(ws_id)] = cid
    return cluster_target.resolve(cid) if cid else None


def _kubectl(target: Optional[Target], args: list[str], timeout: int = 60,
             text: bool = True) -> subprocess.CompletedProcess:
    cmd = ["kubectl"]
    if target and target.kubeconfig:
        cmd += ["--kubeconfig", target.kubeconfig]
    cmd += ["-n", NAMESPACE, *args]
    return subprocess.run(cmd, capture_output=True, text=text, timeout=timeout)


def _ensure_namespace(target: Optional[Target]) -> None:
    try:
        r = _kubectl(target, ["get", "namespace", NAMESPACE], timeout=15)
        if r.returncode != 0:
            subprocess.run(
                ["kubectl", *(["--kubeconfig", target.kubeconfig] if target and target.kubeconfig else []),
                 "create", "namespace", NAMESPACE],
                capture_output=True, text=True, timeout=20)
    except Exception as e:
        logger.warning("namespace check failed on %s: %s", target.id if target else "?", e)


# ── Manifest ─────────────────────────────────────────────────────────────────

def _workspace_manifest(ws, target: Target) -> dict:
    """The tier-enforcement manifest, adapted for a long-lived editable session.

    `sandbox_runtime.manifest_for_workspace` already encodes the security model
    (runtimeClassName, dropped caps, no service-account token, egress label), so
    we build on it rather than writing a second spec that could drift from it.
    """
    m = sandbox_runtime.manifest_for_workspace(ws)
    spec = m["spec"]
    m["metadata"]["name"] = _name(ws.id)
    m["metadata"]["labels"]["cluster-id"] = target.id

    # A workspace pod must outlive its command and survive a crash; the base
    # manifest is shaped for one-shot enforcement runs.
    spec["restartPolicy"] = "Always"

    # Never pin a node. CP-PPO's decision is *which cluster*; picking the node
    # inside it is kube-scheduler's job, and the tier nodeSelector below still
    # gates gVisor/Firecracker onto capable nodes.
    #
    # This must not be conditional on the target being remote. Workspace rows
    # carry node names invented by the old in-memory simulator ("node-a-2",
    # "dev-node-0"), which exist in no cluster — including the home one. A pod
    # pinned to a nonexistent node is admitted but never scheduled, so it sat
    # Pending until the readiness wait expired and every start silently fell
    # back to a local container after a multi-minute hang.
    spec.pop("nodeName", None)

    # The image needs a shell and the language toolchain; the enforcement default
    # (code-server) is a full IDE we do not need here.
    c = spec["containers"][0]
    c["image"] = image_for(ws.language)
    c["command"] = ["sleep", "infinity"]
    c["workingDir"] = "/workspace"
    c["volumeMounts"] = [{"name": "workspace", "mountPath": "/workspace"}]
    spec["volumes"] = [{"name": "workspace", "emptyDir": {}}]

    # emptyDir is created root-owned; without fsGroup the non-root user the
    # security context pins us to cannot write to its own workspace.
    spec.setdefault("securityContext", {})["fsGroup"] = 1000
    return m


# ── Lifecycle ────────────────────────────────────────────────────────────────

def is_running(ws_id: int) -> bool:
    if not available():
        return False
    target = _target_for_id(ws_id)
    try:
        r = _kubectl(target, ["get", "pod", _name(ws_id),
                              "-o", "jsonpath={.status.phase}"], timeout=15)
        return r.returncode == 0 and r.stdout.strip() == "Running"
    except Exception:
        return False


KARMADA_KUBECONFIG = os.getenv("KARMADA_KUBECONFIG", "/etc/astra/karmada.yaml")


def karmada_available() -> bool:
    return os.path.exists(KARMADA_KUBECONFIG)


def _apply_via_karmada(manifest: dict, target: Target) -> bool:
    """Create the pod through the federation, pinned to the chosen cluster.

    CP-PPO decides *where*; Karmada is the mechanism that puts it there. The
    PropagationPolicy names exactly one member via `clusterAffinity.clusterNames`,
    so the learned policy stays the scheduler and Karmada does the plumbing.

    Returns False (rather than raising) if the control plane is unreachable, so
    the caller can fall back to a direct apply — a federation outage should not
    stop someone opening their workspace.
    """
    import json
    if not karmada_available():
        return False
    name = manifest["metadata"]["name"]
    policy = {
        "apiVersion": "policy.karmada.io/v1alpha1",
        "kind": "PropagationPolicy",
        "metadata": {"name": f"{name}-pp", "namespace": NAMESPACE},
        "spec": {
            "resourceSelectors": [
                {"apiVersion": "v1", "kind": "Pod", "name": name, "namespace": NAMESPACE}
            ],
            "placement": {"clusterAffinity": {"clusterNames": [target.id]}},
        },
    }
    docs = json.dumps({"apiVersion": "v1", "kind": "List", "items": [manifest, policy]})
    try:
        subprocess.run(["kubectl", "--kubeconfig", KARMADA_KUBECONFIG,
                        "create", "namespace", NAMESPACE],
                       capture_output=True, text=True, timeout=20)
        r = subprocess.run(["kubectl", "--kubeconfig", KARMADA_KUBECONFIG, "apply", "-f", "-"],
                           input=docs, capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            logger.warning("karmada apply failed: %s", r.stderr.strip()[:300])
            return False
        logger.info("propagated %s to cluster %s via karmada", name, target.id)
        return True
    except Exception as e:
        logger.warning("karmada apply failed: %s", e)
        return False


def _delete_via_karmada(ws_id: int) -> None:
    if not karmada_available():
        return
    name = _name(ws_id)
    for kind, obj in (("propagationpolicy", f"{name}-pp"), ("pod", name)):
        try:
            subprocess.run(["kubectl", "--kubeconfig", KARMADA_KUBECONFIG, "-n", NAMESPACE,
                            "delete", kind, obj, "--ignore-not-found"],
                           capture_output=True, text=True, timeout=45)
        except Exception:
            pass


def _wait_ready(target: Target, pod: str, appear_s: int = 45, ready_s: int = 120) -> bool:
    """Wait for a pod to exist on the member cluster, then to become Ready.

    Two phases, because `kubectl wait` treats a missing object as an error and
    returns instantly rather than waiting for it. When Karmada propagates the
    pod there is a gap — the controller has to create a ResourceBinding and a
    Work object first — during which the member cluster legitimately has no such
    pod. Waiting for Ready straight away turned that normal delay into a failure
    and sent every cross-region workspace down the local-container fallback.
    """
    import time
    deadline = time.time() + appear_s
    while time.time() < deadline:
        r = _kubectl(target, ["get", "pod", pod, "-o", "jsonpath={.metadata.name}"], timeout=20)
        if r.returncode == 0 and r.stdout.strip() == pod:
            break
        time.sleep(2)
    else:
        logger.warning("pod %s never appeared on %s within %ss", pod, target.id, appear_s)
        return False

    # Pulling a language image into a cold region can take a while.
    w = _kubectl(target, ["wait", "--for=condition=Ready", f"pod/{pod}",
                          f"--timeout={ready_s}s"], timeout=ready_s + 20)
    if w.returncode != 0:
        logger.warning("pod %s not Ready on %s: %s", pod, target.id, w.stderr.strip()[:300])
        return False
    return True


def start(ws) -> bool:
    """Create the workspace pod on the cluster CP-PPO chose. True on success."""
    if not available():
        return False
    target = cluster_target.for_workspace(ws)
    remember(ws)
    try:
        import json
        _ensure_namespace(target)
        stop(ws.id)                                   # clear any stale placement
        remember(ws)                                  # stop() clears the cache

        manifest = _workspace_manifest(ws, target)
        via = "karmada" if _apply_via_karmada(manifest, target) else None
        if via is None:
            r = subprocess.run(
                ["kubectl", *(["--kubeconfig", target.kubeconfig] if target.kubeconfig else []),
                 "apply", "-f", "-"],
                input=json.dumps(manifest), capture_output=True, text=True, timeout=90)
            if r.returncode != 0:
                logger.warning("pod apply failed on %s: %s", target.id, r.stderr.strip()[:400])
                return False
            via = "direct"

        # Wait against the MEMBER cluster either way: that is where the pod
        # actually has to be running before a terminal can attach to it, and it
        # is the only check that proves propagation really happened.
        if not _wait_ready(target, _name(ws.id)):
            logger.warning("pod %s not Ready on %s (via %s)", _name(ws.id), target.id, via)
            return False
        logger.info("workspace %s running on cluster %s (%s) via %s",
                    ws.id, target.id, target.location, via)
        _seed_files(ws)
        return True
    except Exception as e:
        logger.warning("pod start failed for workspace %s: %s", ws.id, e)
        return False


def _seed_files(ws) -> None:
    """Copy the workspace's existing files into the pod.

    A pod's volume starts empty, so without this a user who had files would open
    their workspace in a new region and find it bare.
    """
    try:
        from app.services import remote_files, workspace_files
        local = workspace_files.WORKSPACE_DATA_ROOT / f"ws-{ws.id}"
        if local.is_dir() and any(local.iterdir()):
            n = remote_files.push_tree(ws.id, local)
            if n:
                logger.info("seeded %d files into workspace %s", n, ws.id)
    except Exception as e:
        logger.warning("could not seed files for workspace %s: %s", ws.id, e)


def stop(ws_id: int) -> None:
    if not available():
        return
    target = _target_for_id(ws_id)
    # Remove the federated copy first: with the PropagationPolicy still in place
    # Karmada would recreate a pod deleted only on the member.
    _delete_via_karmada(ws_id)
    try:
        _kubectl(target, ["delete", "pod", _name(ws_id), "--ignore-not-found",
                          "--grace-period=5"], timeout=60)
    except Exception:
        pass
    finally:
        forget(ws_id)


def exec_argv(ws_id: int) -> list[str]:
    """Interactive shell inside the workspace pod, wherever that pod lives.

    Returned as argv (not a shell string) so the terminal transport is identical
    to the local Docker path.
    """
    target = _target_for_id(ws_id)
    kc = ["--kubeconfig", target.kubeconfig] if target and target.kubeconfig else []
    return ["kubectl", *kc, "-n", NAMESPACE, "exec", "-i", "-t",
            _name(ws_id), "--", "/bin/sh"]


@dataclass
class ExecResult:
    """subprocess.CompletedProcess-shaped, so callers read the same fields."""
    returncode: int
    stdout:     str
    stderr:     str


_API_CACHE: dict[str, object] = {}


def _api(target: Optional[Target]):
    """CoreV1Api for a cluster, cached so the TLS connection is pooled.

    Measured on the Mumbai→Belgium link (352 ms RTT): a fresh `kubectl` costs
    ~2280 ms per exec, while a reused client costs ~1090 ms. Regular API calls
    drop to ~358 ms — one round trip — because pooling removes the handshake.
    Exec still opens its own upgraded connection, so it cannot reach that floor.
    """
    key = (target.kubeconfig if target and target.kubeconfig else "__default__")
    api = _API_CACHE.get(key)
    if api is None:
        from kubernetes import client, config
        cfg = client.Configuration()
        if target and target.kubeconfig:
            config.load_kube_config(config_file=target.kubeconfig, client_configuration=cfg)
            api = client.CoreV1Api(client.ApiClient(cfg))
        else:
            try:
                config.load_incluster_config()
            except Exception:
                config.load_kube_config()
            api = client.CoreV1Api()
        _API_CACHE[key] = api
    return api


def exec_capture(ws_id: int, argv: list[str], timeout: int = 20,
                 stdin: Optional[str] = None, text: bool = True) -> ExecResult:
    """Run a command in the pod and capture output. Used by remote file I/O.

    Text-only by design: the exec channel decodes as UTF-8, so binary payloads
    are base64-framed by the caller (`remote_files`) rather than risking silent
    corruption here.
    """
    from kubernetes.stream import stream
    from kubernetes.stream.ws_client import ERROR_CHANNEL

    target = _target_for_id(ws_id)
    try:
        resp = stream(
            _api(target).connect_get_namespaced_pod_exec,
            _name(ws_id), NAMESPACE, command=list(argv),
            stderr=True, stdin=stdin is not None, stdout=True, tty=False,
            _preload_content=False,
        )
        if stdin is not None:
            resp.write_stdin(stdin)
        resp.run_forever(timeout=timeout)
        out, err = resp.read_stdout(), resp.read_stderr()
        # The error channel carries a Status object; a non-zero exit shows up as
        # an ExitCode cause rather than an exception.
        rc = 0
        try:
            import json
            status = json.loads(resp.read_channel(ERROR_CHANNEL) or "{}")
            if status.get("status") == "Failure":
                rc = 1
                for cause in (status.get("details") or {}).get("causes") or []:
                    if cause.get("reason") == "ExitCode":
                        rc = int(cause.get("message", 1))
        except Exception:
            pass
        resp.close()
        return ExecResult(rc, out or "", err or "")
    except Exception as e:
        return ExecResult(1, "", str(e))


# ── Observability ────────────────────────────────────────────────────────────

def stats(ws_id: int) -> dict | None:
    """{cpu_pct, mem_mb, mem_pct} from metrics-server, or None."""
    if not is_running(ws_id):
        return None
    target = _target_for_id(ws_id)
    try:
        r = _kubectl(target, ["top", "pod", _name(ws_id), "--no-headers"], timeout=20)
        if r.returncode != 0 or not r.stdout.strip():
            return None
        parts = r.stdout.split()
        cpu_m = float(re.sub(r"[^\d.]", "", parts[1]) or 0)     # millicores
        mem_mi = float(re.sub(r"[^\d.]", "", parts[2]) or 0)    # Mi
    except Exception:
        return None

    limit_mb = 0.0
    try:
        lr = _kubectl(target, ["get", "pod", _name(ws_id), "-o",
                               "jsonpath={.spec.containers[0].resources.limits.memory}"], timeout=15)
        raw = (lr.stdout or "").strip()
        if raw.endswith("Mi"):
            limit_mb = float(raw[:-2])
        elif raw.endswith("Gi"):
            limit_mb = float(raw[:-2]) * 1024
    except Exception:
        pass

    return {
        "cpu_pct": round(cpu_m / 10.0, 1),                       # 1000m = 100%
        "mem_mb": round(mem_mi, 1),
        "mem_pct": round(mem_mi / limit_mb * 100, 1) if limit_mb else 0.0,
    }


def logs(ws_id: int, tail: int = 50) -> list[str]:
    if not available():
        return []
    target = _target_for_id(ws_id)
    try:
        r = _kubectl(target, ["logs", "--tail", str(tail), _name(ws_id)], timeout=20)
        out = (r.stdout + r.stderr).strip()
        return out.splitlines() if out else []
    except Exception:
        return []


def list_listening_ports(ws_id: int) -> list[int]:
    if not is_running(ws_id):
        return []
    try:
        r = exec_capture(ws_id, ["sh", "-c",
                                 "ss -tlnH 2>/dev/null || netstat -tln 2>/dev/null"], timeout=15)
    except Exception:
        return []
    ports: set[int] = set()
    for line in (r.stdout or "").splitlines():
        m = re.search(r"[:.](\d{2,5})\s", line + " ")
        if m:
            p = int(m.group(1))
            if 1 <= p <= 65535:
                ports.add(p)
    return sorted(ports)


def fetch_port(ws_id: int, port: int, path: str) -> tuple[bytes, str] | None:
    """Proxy an HTTP GET to a dev server inside the pod, mirroring the Docker path."""
    if not is_running(ws_id):
        return None
    import base64
    p = (path or "").lstrip("/")
    url = f"http://127.0.0.1:{int(port)}/{p}"

    # A dev server may return images or other binary content, and the exec
    # channel is UTF-8, so every response is base64-framed in the pod. The URL
    # is passed as a positional parameter ($1) rather than interpolated, so a
    # crafted path cannot break out into the shell.
    pyfetch = ('import sys,urllib.request;'
               'sys.stdout.buffer.write(urllib.request.urlopen(sys.argv[1],timeout=10).read())')
    nodefetch = ("const h=require('http');h.get(process.argv[1],r=>{const d=[];"
                 "r.on('data',c=>d.push(c));r.on('end',()=>process.stdout.write(Buffer.concat(d)))})"
                 ".on('error',()=>process.exit(1))")
    attempts = [
        'curl -sS -m 10 -- "$1" | base64',
        'wget -qO- -T 10 -- "$1" | base64',
        f'python3 -c \'{pyfetch}\' "$1" | base64',
        f'python -c \'{pyfetch}\' "$1" | base64',
        f'node -e \'{nodefetch}\' "$1" | base64',
    ]
    for script in attempts:
        try:
            r = exec_capture(ws_id, ["sh", "-c", script, "_", url], timeout=25)
        except Exception:
            continue
        if r.returncode == 0 and (r.stdout or "").strip():
            try:
                body = base64.b64decode(r.stdout.replace("\n", ""), validate=False)
            except Exception:
                continue
            if not body:
                continue
            import mimetypes
            ctype = mimetypes.guess_type(p or "index.html")[0] or "text/html; charset=utf-8"
            return body, ctype
    return None
