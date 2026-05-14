"""Workspace CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User, Workspace
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceOut,
    WorkspaceList,
)
from app.services import workspace_service

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
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
    items = (
        db.query(Workspace)
        .filter(Workspace.owner_id == current_user.id)
        .order_by(Workspace.created_at.desc())
        .all()
    )
    return WorkspaceList(total=len(items), items=[WorkspaceOut.model_validate(w) for w in items])


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id)
        .first()
    )
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
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id)
        .first()
    )
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
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id)
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if workspace.status == "RUNNING":
        return WorkspaceOut.model_validate(workspace)

    # In production: call scheduler to actually launch the pod
    workspace_service.transition_status(db, workspace, "RUNNING")
    return WorkspaceOut.model_validate(workspace)


@router.post("/{workspace_id}/stop", response_model=WorkspaceOut)
def stop_workspace(
    workspace_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
) -> WorkspaceOut:
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id)
        .first()
    )
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
    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.owner_id == current_user.id)
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    db.delete(workspace)
    db.commit()
