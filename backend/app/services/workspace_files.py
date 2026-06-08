"""
Per-workspace file storage + GitHub repo import.

Each workspace gets a directory under WORKSPACE_DATA_ROOT. Supports importing a
public git repo (the "bring a GitHub repo" flow), listing the file tree, and
reading/writing files. All paths are confined to the workspace directory
(path-traversal safe), and imports are restricted to https git hosts.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

WORKSPACE_DATA_ROOT = Path(
    os.getenv("ASTRA_WORKSPACE_DATA", Path(__file__).resolve().parents[2] / "workspace_data")
)
MAX_FILE_BYTES = 1 * 1024 * 1024            # 1 MB per file read/write
_ALLOWED_GIT = re.compile(r"^https://(github\.com|gitlab\.com|bitbucket\.org)/[\w.\-]+/[\w.\-]+(\.git)?/?$")
_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".next", "dist", "build", "venv", ".venv"}


def _ws_dir(workspace_id: int) -> Path:
    d = WORKSPACE_DATA_ROOT / f"ws-{workspace_id}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def workspace_dir(workspace_id: int) -> Path:
    """Public accessor for the workspace's on-disk directory (used by the terminal)."""
    return _ws_dir(workspace_id)


def _safe_path(workspace_id: int, rel: str) -> Path:
    """Resolve `rel` inside the workspace dir; reject traversal outside it."""
    base = _ws_dir(workspace_id).resolve()
    target = (base / rel.lstrip("/")).resolve()
    if base != target and base not in target.parents:
        raise ValueError("path escapes workspace")
    return target


@dataclass
class ImportResult:
    ok: bool
    detail: str
    file_count: int = 0


def import_repo(workspace_id: int, git_url: str) -> ImportResult:
    """Shallow-clone a public git repo into the workspace (replacing its contents)."""
    git_url = git_url.strip()
    if not _ALLOWED_GIT.match(git_url):
        return ImportResult(False, "only public https github/gitlab/bitbucket repos are allowed")
    base = _ws_dir(workspace_id)
    # clone into a temp sibling then move contents in (keeps base stable)
    tmp = base.parent / f".clone-{workspace_id}"
    shutil.rmtree(tmp, ignore_errors=True)
    try:
        r = subprocess.run(
            ["git", "clone", "--depth", "1", git_url, str(tmp)],
            capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            return ImportResult(False, f"clone failed: {(r.stderr or '')[-200:]}")
        # wipe workspace + move cloned files in (drop .git)
        for child in base.iterdir():
            shutil.rmtree(child, ignore_errors=True) if child.is_dir() else child.unlink()
        shutil.rmtree(tmp / ".git", ignore_errors=True)
        for child in tmp.iterdir():
            shutil.move(str(child), str(base / child.name))
        n = sum(1 for _ in base.rglob("*") if _.is_file())
        return ImportResult(True, f"imported {git_url}", n)
    except subprocess.TimeoutExpired:
        return ImportResult(False, "clone timed out (repo too large?)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def list_tree(workspace_id: int, max_entries: int = 2000) -> list[dict]:
    """Flat list of files/dirs (relative paths) for the workspace, skipping noise."""
    base = _ws_dir(workspace_id)
    out: list[dict] = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in _SKIP_DIRS]
        rel_root = os.path.relpath(root, base)
        for d in sorted(dirs):
            p = "" if rel_root == "." else rel_root + "/"
            out.append({"path": p + d, "type": "dir"})
        for f in sorted(files):
            p = "" if rel_root == "." else rel_root + "/"
            try:
                size = (Path(root) / f).stat().st_size
            except OSError:
                size = 0
            out.append({"path": p + f, "type": "file", "size": size})
        if len(out) >= max_entries:
            break
    return sorted(out, key=lambda e: e["path"])[:max_entries]


def read_file(workspace_id: int, rel: str) -> str:
    p = _safe_path(workspace_id, rel)
    if not p.is_file():
        raise FileNotFoundError(rel)
    if p.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("file too large to open")
    return p.read_text(encoding="utf-8", errors="replace")


def write_file(workspace_id: int, rel: str, content: str) -> int:
    if len(content.encode("utf-8", errors="replace")) > MAX_FILE_BYTES:
        raise ValueError("file too large to save")
    p = _safe_path(workspace_id, rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p.stat().st_size


def delete_workspace_files(workspace_id: int) -> None:
    shutil.rmtree(_ws_dir(workspace_id), ignore_errors=True)
