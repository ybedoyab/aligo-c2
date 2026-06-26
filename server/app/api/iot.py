"""IoT lab REST endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.database import get_session
from app.schemas.iot import IoTActionRequest, IoTLabRead
from app.schemas.task import TaskRead
from app.services import iot_service, task_service
from app.websocket import dispatch

router = APIRouter(prefix="/api/iot", tags=["iot"])


@router.get("/lab", response_model=IoTLabRead)
def get_iot_lab(session: Session = Depends(get_session)) -> IoTLabRead:
    state = iot_service.get_lab_state(session)
    return IoTLabRead(**state)


@router.post("/actions", response_model=TaskRead)
async def run_iot_action(
    body: IoTActionRequest, session: Session = Depends(get_session)
) -> TaskRead:
    gateway = iot_service.get_gateway(session, body.gateway_id)
    if gateway is None or gateway.status.value != "online":
        raise HTTPException(
            status_code=400,
            detail=f"IoT gateway '{body.gateway_id}' is not connected",
        )

    task = task_service.create_task(
        session,
        mission_id="",
        node_id=body.gateway_id,
        plugin=body.plugin,
        args=body.args,
    )
    await dispatch.dispatch_tasks([task.id])
    session.refresh(task)
    return TaskRead.model_validate(task)
