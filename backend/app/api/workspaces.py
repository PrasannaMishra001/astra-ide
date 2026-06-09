"""Workspace CRUD endpoints + sharing + code execution + terminal."""
import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import decode_access_token
from app.db.session import SessionLocal, get_db
from app.models import User, Workspace
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceOut, WorkspaceList,
    ShareRequest, MemberOut, MemberList,
    ExecuteRequest, ExecuteResponse,
)
from app.services import workspace_service
from app.services import sharing_service
from app.services import executor_service
from app.services import workspace_files
from app.services import object_store
from app.services.terminal_service import TerminalProcess
from pydantic import BaseModel, Field

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class ImportRepoRequest(BaseModel):
    git_url: str = Field(min_length=8, max_length=300)


class WriteFileRequest(BaseModel):
    path:    str = Field(min_length=1, max_length=400)
    content: str = Field(max_length=1_000_000)


def _require_access(db: Session, workspace_id: int, user_id: int) -> None:
    if not sharing_service.user_can_access(db, workspace_id, user_id):
        raise HTTPException(status_code=404, detail="Workspace not found")


# ── Core CRUD (now access-aware: owner OR member) ───────────────────────────

@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload:      WorkspaceCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = workspace_service.create_workspace_for_user(db, current_user, payload)
    return WorkspaceOut.model_validate(workspace)


@router.get("", response_model=WorkspaceList)
def list_workspaces(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceList:
    items = sharing_service.get_accessible_workspaces(db, current_user.id)
    return WorkspaceList(total=len(items),
                         items=[WorkspaceOut.model_validate(w) for w in items])


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = sharing_service.get_workspace_for_user(db, workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return WorkspaceOut.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: int,
    payload:      WorkspaceUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = sharing_service.get_workspace_for_user(db, workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if payload.name is not None:
        workspace.name = payload.name
    if payload.status is not None:
        workspace.status = payload.status

    db.commit()
    db.refresh(workspace)
    return WorkspaceOut.model_validate(workspace)


@router.post("/{workspace_id}/start", response_model=WorkspaceOut)
def start_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = sharing_service.get_workspace_for_user(db, workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if workspace.status == "RUNNING":
        return WorkspaceOut.model_validate(workspace)
    workspace_service.transition_status(db, workspace, "RUNNING")
    return WorkspaceOut.model_validate(workspace)


@router.post("/{workspace_id}/stop", response_model=WorkspaceOut)
def stop_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = sharing_service.get_workspace_for_user(db, workspace_id, current_user.id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    workspace_service.transition_status(db, workspace, "STOPPED")
    return WorkspaceOut.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> None:
    # Only the OWNER can delete (not collaborators)
    if not sharing_service.user_owns(db, workspace_id, current_user.id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    db.delete(workspace)
    db.commit()


# ── Sharing endpoints ───────────────────────────────────────────────────────

@router.get("/{workspace_id}/members", response_model=MemberList)
def list_members(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> MemberList:
    if not sharing_service.user_can_access(db, workspace_id, current_user.id):
        raise HTTPException(status_code=404, detail="Workspace not found")
    items = sharing_service.list_members(db, workspace_id)
    return MemberList(total=len(items), items=items)


@router.post("/{workspace_id}/share", status_code=status.HTTP_201_CREATED)
def share_workspace(
    workspace_id: int,
    payload:      ShareRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> dict:
    """Invite another user as a collaborator (editor or viewer)."""
    member = sharing_service.share_workspace(
        db, workspace_id, current_user.id,
        target_username=payload.username, role=payload.role,
    )
    return {
        "workspace_id": workspace_id,
        "user_id":      member.user_id,
        "username":     payload.username,
        "role":         member.role,
    }


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    workspace_id: int,
    user_id:      int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> None:
    """Remove a collaborator. Only the owner can do this."""
    removed = sharing_service.unshare_workspace(db, workspace_id, current_user.id, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found")


# ── Code execution ──────────────────────────────────────────────────────────

@router.post("/{workspace_id}/execute", response_model=ExecuteResponse)
def execute_code(
    workspace_id: int,
    payload:      ExecuteRequest,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> ExecuteResponse:
    """
    Run the given code in the requested language and return stdout/stderr.

    This is the demo executor — production execution should route through
    the workspace's assigned sandbox pod (Phase 3+).
    """
    if not sharing_service.user_can_access(db, workspace_id, current_user.id):
        raise HTTPException(status_code=404, detail="Workspace not found")

    result = executor_service.execute(
        language=payload.language,
        code=payload.code,
        stdin=payload.stdin,
    )
    return ExecuteResponse(
        language=result.language,
        exit_code=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        runtime_ms=result.runtime_ms,
        timeout=result.timeout,
        truncated=result.truncated,
    )


# ── Files + GitHub import ───────────────────────────────────────────────────

@router.post("/{workspace_id}/import-repo")
def import_repo(workspace_id: int, payload: ImportRepoRequest,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)) -> dict:
    """Bring a public GitHub/GitLab repo into the workspace (shallow clone)."""
    _require_access(db, workspace_id, current_user.id)
    res = workspace_files.import_repo(workspace_id, payload.git_url)
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.detail)
    return {"ok": True, "detail": res.detail, "file_count": res.file_count}


@router.get("/{workspace_id}/files")
def list_files(workspace_id: int, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> dict:
    """File tree of the workspace (for the file-manager panel)."""
    _require_access(db, workspace_id, current_user.id)
    return {"files": workspace_files.list_tree(workspace_id)}


@router.get("/{workspace_id}/file")
def read_file(workspace_id: int, path: str, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)) -> dict:
    """Read a single file's contents."""
    _require_access(db, workspace_id, current_user.id)
    try:
        return {"path": path, "content": workspace_files.read_file(workspace_id, path)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{workspace_id}/file")
def write_file(workspace_id: int, payload: WriteFileRequest,
               db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)) -> dict:
    """Create/overwrite a file (editor save)."""
    _require_access(db, workspace_id, current_user.id)
    try:
        size = workspace_files.write_file(workspace_id, payload.path, payload.content)
        return {"ok": True, "path": payload.path, "size": size}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Snapshots (MinIO object storage) ────────────────────────────────────────

@router.post("/{workspace_id}/snapshot")
def snapshot_workspace(workspace_id: int, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)) -> dict:
    """Archive the workspace files to object storage (MinIO)."""
    _require_access(db, workspace_id, current_user.id)
    res = object_store.snapshot_workspace(workspace_id)
    if not res.ok:
        raise HTTPException(status_code=503, detail=res.detail)
    return {"ok": True, "detail": res.detail, "key": res.key, "size": res.size}


@router.post("/{workspace_id}/restore")
def restore_workspace(workspace_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)) -> dict:
    """Restore the workspace files from the latest object-storage snapshot."""
    _require_access(db, workspace_id, current_user.id)
    res = object_store.restore_workspace(workspace_id)
    if not res.ok:
        raise HTTPException(status_code=503, detail=res.detail)
    return {"ok": True, "detail": res.detail, "key": res.key, "size": res.size}


# ── Interactive terminal (xterm.js over WebSocket) ──────────────────────────

@router.websocket("/{workspace_id}/terminal")
async def terminal_ws(websocket: WebSocket, workspace_id: int, token: str | None = None) -> None:
    """
    Bridge an xterm.js terminal to a real shell rooted in the workspace dir.
    Auth is via the `token` query param (WebSocket can't carry the Bearer header
    the way fetch does). Client frames are JSON: {"i": "<input>"} for keystrokes,
    {"r": [rows, cols]} for resize. Server streams raw shell output as text.
    """
    await websocket.accept()

    # Authenticate + authorize on a short-lived DB session (no Depends in ws).
    user_id = decode_access_token(token) if token else None
    if user_id is None:
        await websocket.close(code=4401)
        return
    db = SessionLocal()
    try:
        if not sharing_service.user_can_access(db, workspace_id, int(user_id)):
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    cwd = workspace_files.workspace_dir(workspace_id)
    term = TerminalProcess(cwd)
    loop = asyncio.get_event_loop()

    async def pump_output() -> None:
        try:
            while term.alive:
                data = await loop.run_in_executor(None, term.read_blocking, 0.2)
                if data:
                    await websocket.send_text(data.decode(errors="replace"))
            await websocket.send_text("\r\n[process exited]\r\n")
        except Exception:
            pass

    out_task = asyncio.create_task(pump_output())
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                term.write(raw)            # tolerate a plain input frame
                continue
            if "i" in msg:
                term.write(msg["i"])
            elif "r" in msg and isinstance(msg["r"], list) and len(msg["r"]) == 2:
                term.resize(int(msg["r"][0]), int(msg["r"][1]))
    except WebSocketDisconnect:
        pass
    finally:
        term.close()
        out_task.cancel()
