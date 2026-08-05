"""File operations for a workspace whose pod lives in another region.

The local path (`workspace_files`) reads and writes the backend's own disk. That
disk does not exist in Belgium, so for a remote workspace every operation is
performed *inside the pod* over `kubectl exec` instead.

Two constraints shape everything here:

* **Portability.** Workspace images are a mix of Debian (python, node, gcc) and
  BusyBox (alpine, golang). BusyBox `find` has no `-printf`, so the tree walk
  uses a plain shell loop that works on both rather than the faster GNU form.
* **Injection safety.** Paths come from the client. Commands are passed as argv,
  never interpolated into a shell string; where a shell really is needed the
  path arrives as a positional parameter (`$1`) so the shell never parses it.

Each call is one round trip to the region, so callers should batch where they
can — this is why `list_tree` returns sizes in the same pass.
"""
from __future__ import annotations

import logging
import mimetypes
import posixpath

logger = logging.getLogger(__name__)

WORKDIR = "/workspace"
MAX_FILE_BYTES = 1 * 1024 * 1024
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".next", "dist", "build", "venv", ".venv"}


class RemoteError(RuntimeError):
    """A command inside the pod failed."""


def safe_rel(rel: str) -> str:
    """Normalise a client-supplied path and refuse anything leaving /workspace.

    Mirrors `workspace_files._safe_path`, but resolves textually because there is
    no local filesystem to resolve against.
    """
    # Normalise the path as RELATIVE, not as "/" + rel: normpath on an absolute
    # path silently collapses a leading ".." away, turning "a/../../etc" into
    # "/etc" and then "etc" — contained, but it hides the traversal instead of
    # rejecting it, and diverges from the local path which raises.
    cleaned = posixpath.normpath((rel or "").replace("\\", "/").lstrip("/"))
    if cleaned in ("", "."):
        return ""
    if cleaned == ".." or cleaned.startswith("../") or posixpath.isabs(cleaned):
        raise ValueError("path escapes workspace")
    return cleaned


def _abs(rel: str) -> str:
    r = safe_rel(rel)
    return posixpath.join(WORKDIR, r) if r else WORKDIR


def _run(ws_id: int, argv: list[str], *, stdin=None, timeout: int = 25):
    from app.services import pod_service
    return pod_service.exec_capture(ws_id, argv, timeout=timeout, stdin=stdin)


def _check(r, what: str):
    if r.returncode != 0:
        raise RemoteError(f"{what}: {(r.stderr or '').strip()[:200]}")
    return r


# ── Reads ────────────────────────────────────────────────────────────────────

# One `wc -c` per file is a fork per entry, but it is the only size call BusyBox
# and GNU agree on. The entry cap keeps that bounded.
_TREE_SCRIPT = r'''
cd /workspace 2>/dev/null || exit 0
find . -mindepth 1 \( -name .git -o -name node_modules -o -name __pycache__ \
  -o -name .next -o -name dist -o -name build -o -name venv -o -name .venv \) -prune -o -print 2>/dev/null \
| head -n "$1" \
| while IFS= read -r p; do
    q=${p#./}
    if [ -d "$p" ]; then printf 'd\t0\t%s\n' "$q"
    else printf 'f\t%s\t%s\n' "$(wc -c < "$p" 2>/dev/null || echo 0)" "$q"; fi
  done
'''


def list_tree(ws_id: int, max_entries: int = 2000) -> list[dict]:
    try:
        r = _run(ws_id, ["sh", "-c", _TREE_SCRIPT, "_", str(max_entries)], timeout=45)
    except Exception as e:
        logger.warning("remote list_tree failed for ws %s: %s", ws_id, e)
        return []
    out: list[dict] = []
    for line in (r.stdout or "").splitlines():
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        kind, size, path = parts
        if not path or any(seg in SKIP_DIRS for seg in path.split("/")):
            continue
        if kind == "d":
            out.append({"path": path, "type": "dir"})
        else:
            try:
                out.append({"path": path, "type": "file", "size": int(size.strip() or 0)})
            except ValueError:
                out.append({"path": path, "type": "file", "size": 0})
    return sorted(out, key=lambda e: e["path"])[:max_entries]


def read_file(ws_id: int, rel: str) -> str:
    path = _abs(rel)
    r = _run(ws_id, ["sh", "-c", 'test -f "$1" || exit 44; cat -- "$1"', "_", path], timeout=30)
    if r.returncode == 44:
        raise FileNotFoundError(rel)
    _check(r, f"read {rel}")
    text = r.stdout or ""
    if len(text.encode("utf-8", "replace")) > MAX_FILE_BYTES:
        raise ValueError("file too large to open")
    return text


def read_bytes(ws_id: int, rel: str) -> tuple[bytes, str]:
    # The exec channel decodes as UTF-8, so raw bytes would be corrupted in
    # transit. base64 costs ~33% more bytes but survives the round trip intact,
    # and is present in both coreutils and BusyBox.
    import base64
    path = _abs(rel)
    r = _run(ws_id, ["sh", "-c", 'test -f "$1" || exit 44; base64 -- "$1"', "_", path],
             timeout=60)
    if r.returncode == 44:
        raise FileNotFoundError(rel)
    _check(r, f"read {rel}")
    try:
        data = base64.b64decode((r.stdout or "").replace("\n", ""), validate=False)
    except Exception as e:
        raise RemoteError(f"read {rel}: undecodable payload ({e})")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("file too large")
    ctype = mimetypes.guess_type(posixpath.basename(path))[0] or "application/octet-stream"
    return data, ctype


_SEARCH_SCRIPT = r'''
cd /workspace 2>/dev/null || exit 0
find . -type d \( -name .git -o -name node_modules -o -name __pycache__ \
  -o -name .next -o -name dist -o -name build -o -name venv -o -name .venv \) -prune \
  -o -type f -print 2>/dev/null \
| head -n 5000 | tr '\n' '\0' \
| xargs -0 grep -niI -e "$1" /dev/null 2>/dev/null \
| head -n 400
'''


def search(ws_id: int, query: str, max_results: int = 200) -> list[dict]:
    if not query:
        return []
    # `grep --exclude-dir` is GNU-only and BusyBox images (alpine, golang) fail
    # on it, so noise directories are pruned with `find` instead — which both
    # implementations support — and the file list is piped into grep. `/dev/null`
    # keeps grep printing filenames even when only one file matches.
    try:
        r = _run(ws_id, ["sh", "-c", _SEARCH_SCRIPT, "_", query], timeout=60)
    except Exception as e:
        logger.warning("remote search failed for ws %s: %s", ws_id, e)
        return []
    out: list[dict] = []
    for line in (r.stdout or "").splitlines():
        parts = line.split(":", 2)
        if len(parts) != 3:
            continue
        path, lineno, text = parts
        path = path.lstrip("./")
        if any(seg in SKIP_DIRS for seg in path.split("/")):
            continue
        try:
            out.append({"path": path, "line": int(lineno), "text": text.strip()[:240]})
        except ValueError:
            continue
        if len(out) >= max_results:
            break
    return out


# ── Writes ───────────────────────────────────────────────────────────────────

def write_file(ws_id: int, rel: str, content: str) -> int:
    data = content.encode("utf-8", errors="replace")
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("file too large to save")
    return _write(ws_id, rel, content)


def write_bytes_file(ws_id: int, rel: str, data: bytes) -> int:
    import base64
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("file too large to upload (max 8 MB)")
    return _write(ws_id, rel, base64.b64encode(data).decode("ascii"), binary=True)


def _write(ws_id: int, rel: str, payload: str, *, binary: bool = False) -> int:
    """Stream content into a file in the pod and return its size.

    `head -c $2` rather than `cat` is deliberate: the Kubernetes exec stream has
    no way to half-close stdin, so `cat` would block waiting for an EOF that
    never arrives and leave the file empty. Reading an exact byte count makes the
    command terminate on its own.

    The size is echoed by the same command instead of a follow-up `wc -c`, which
    halves the cost of a save on a link where each round trip is ~1.1 s.
    """
    path = _abs(rel)
    if path == WORKDIR:
        raise ValueError("cannot write the workspace root")
    nbytes = len(payload.encode("utf-8", errors="replace"))
    sink = 'head -c "$2" | base64 -d > "$1"' if binary else 'head -c "$2" > "$1"'
    r = _run(ws_id,
             ["sh", "-c",
              f'mkdir -p -- "$(dirname "$1")" && {sink} && wc -c < "$1"',
              "_", path, str(nbytes)],
             stdin=payload, timeout=90)
    _check(r, f"write {rel}")
    try:
        return int((r.stdout or "0").strip().split()[0])
    except (ValueError, IndexError):
        return 0


def make_dir(ws_id: int, rel: str) -> None:
    path = _abs(rel)
    if path == WORKDIR:
        return
    _check(_run(ws_id, ["mkdir", "-p", "--", path], timeout=20), f"mkdir {rel}")


def delete_path(ws_id: int, rel: str) -> None:
    path = _abs(rel)
    if path == WORKDIR:
        raise ValueError("cannot delete the workspace root")
    r = _run(ws_id, ["sh", "-c", 'test -e "$1" || exit 44; rm -rf -- "$1"', "_", path], timeout=30)
    if r.returncode == 44:
        raise FileNotFoundError(rel)
    _check(r, f"delete {rel}")


# ── Seeding ──────────────────────────────────────────────────────────────────

def push_tree(ws_id: int, local_dir) -> int:
    """Copy a local workspace directory into the remote pod.

    Used when a workspace is (re)started in another region so the user's files
    travel with it. `kubectl cp` needs tar in the image, which BusyBox has, so a
    single streamed archive beats one exec per file.
    """
    import subprocess
    import tarfile
    import io
    from pathlib import Path
    from app.services import pod_service

    local = Path(local_dir)
    if not local.is_dir():
        return 0

    buf = io.BytesIO()
    n = 0
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for item in local.rglob("*"):
            relp = item.relative_to(local)
            if any(part in SKIP_DIRS for part in relp.parts):
                continue
            if item.is_file():
                tar.add(item, arcname=str(relp).replace("\\", "/"))
                n += 1
    if n == 0:
        return 0

    target = pod_service._target_for_id(ws_id)
    kc = ["--kubeconfig", target.kubeconfig] if target and target.kubeconfig else []
    cmd = ["kubectl", *kc, "-n", pod_service.NAMESPACE, "exec", "-i",
           pod_service._name(ws_id), "--", "tar", "-xf", "-", "-C", WORKDIR]
    try:
        r = subprocess.run(cmd, input=buf.getvalue(), capture_output=True, timeout=180)
        if r.returncode != 0:
            logger.warning("push_tree failed for ws %s: %s", ws_id,
                           r.stderr.decode("utf-8", "replace")[:200])
            return 0
    except Exception as e:
        logger.warning("push_tree failed for ws %s: %s", ws_id, e)
        return 0
    return n
