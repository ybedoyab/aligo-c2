"""IoT lab state and quick-action helpers."""

from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from app.core.enums import NodeType, TaskStatus
from app.core.iot_plugins import DEFAULT_GATEWAY_ID, IOT_PLUGINS
from app.models.node import Node
from app.models.result import Result
from app.models.task import Task
from app.services import node_service, result_service, task_service


def _action_label(plugin: str) -> str:
    labels = {
        "gateway_health": "Gateway health check",
        "list_devices": "Listed subdevices",
        "get_device_info": "Read device info",
        "get_gateway_snapshot": "Captured gateway snapshot",
        "read_temperature": "Read temperature sensor",
        "read_humidity": "Read humidity sensor",
        "read_motion": "Read motion sensor",
        "read_light": "Read ambient light sensor",
        "led_on": "LED turned ON",
        "led_off": "LED turned OFF",
        "led_blink": "LED blinked",
        "led_set_brightness": "LED brightness set",
    }
    return labels.get(plugin, plugin.replace("_", " "))


def _device_type_for(plugin: str, device_id: str | None, snapshot: dict | None) -> str | None:
    if not device_id or not snapshot:
        return None
    for dev in snapshot.get("devices") or []:
        if dev.get("device_id") == device_id:
            return dev.get("device_type")
    if plugin.startswith("led_"):
        return "actuator"
    if plugin.startswith("read_"):
        return "sensor"
    return None


def build_iot_evidence_extras(
    *,
    task: Task,
    node: Node | None,
    result: Result | None,
) -> dict[str, Any]:
    """Populate IoT-specific evidence fields for task evidence views."""
    meta = (result.result_metadata if result else {}) or {}
    device_id = task.args.get("device_id") or meta.get("device_id")
    plugin = task.plugin
    is_iot = (
        plugin in IOT_PLUGINS
        or meta.get("evidence_type") == "iot_action"
        or (node and node.node_type == NodeType.IOT_GATEWAY)
    )
    if not is_iot:
        return {}

    snapshot = node.iot_snapshot if node else None
    device_type = _device_type_for(plugin, device_id, snapshot)
    return {
        "node_type": str(node.node_type) if node else "iot_gateway",
        "device_id": device_id,
        "device_type": device_type,
        "evidence_class": "iot_action",
        "iot_summary": {
            "gateway": task.node_id,
            "subdevice": device_id,
            "physical_style_action": _action_label(plugin),
            "simulated_execution": True,
            "evidence_class": "iot_action",
        },
    }


def get_gateway(session: Session, gateway_id: str = DEFAULT_GATEWAY_ID) -> Node | None:
    return node_service.get_node(session, gateway_id)


def list_iot_events(session: Session, gateway_id: str = DEFAULT_GATEWAY_ID, limit: int = 30) -> list[dict[str, Any]]:
    tasks = session.exec(
        select(Task)
        .where(Task.node_id == gateway_id)
        .order_by(Task.created_at.desc())  # type: ignore[arg-type]
        .limit(limit)
    ).all()
    events: list[dict[str, Any]] = []
    for task in tasks:
        if task.plugin not in IOT_PLUGINS:
            continue
        result = result_service.get_result_for_task(session, task.id)
        events.append(
            {
                "task_id": task.id,
                "plugin": task.plugin,
                "args": task.args,
                "status": str(task.status),
                "device_id": task.args.get("device_id"),
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "stdout_preview": (result.stdout[:200] if result else ""),
            }
        )
    return events


def get_lab_state(session: Session, gateway_id: str = DEFAULT_GATEWAY_ID) -> dict[str, Any]:
    gateway = get_gateway(session, gateway_id)
    devices = (gateway.iot_devices if gateway else None) or []
    snapshot = (gateway.iot_snapshot if gateway else None) or {}
    policy = gateway.policy_id if gateway else "iot_demo_policy"

    telemetry = {"temperature_c": None, "humidity_pct": None, "motion_detected": None, "lux": None, "led": None}
    for dev in devices:
        state = dev.get("state") or {}
        did = dev.get("device_id")
        if did == "temp-001":
            telemetry["temperature_c"] = state.get("temperature_c")
        elif did == "humidity-001":
            telemetry["humidity_pct"] = state.get("humidity_pct")
        elif did == "motion-001":
            telemetry["motion_detected"] = state.get("motion_detected")
        elif did == "light-001":
            telemetry["lux"] = state.get("lux")
        elif did == "led-001":
            telemetry["led"] = state

    recent = list_iot_events(session, gateway_id=gateway_id, limit=20)
    success_count = sum(1 for t in recent if t["status"] == str(TaskStatus.SUCCESS))

    return {
        "gateway_id": gateway_id,
        "online": gateway is not None and gateway.status.value == "online",
        "status": str(gateway.status) if gateway else "offline",
        "health_score": gateway.health_score if gateway else 0,
        "policy_id": policy,
        "last_seen": gateway.last_seen.isoformat() if gateway else None,
        "node_type": str(gateway.node_type) if gateway else NodeType.IOT_GATEWAY.value,
        "subdevice_count": len(devices),
        "devices": devices,
        "snapshot": snapshot,
        "telemetry": telemetry,
        "recent_events": recent,
        "stats": {
            "recent_iot_tasks": len(recent),
            "recent_successes": success_count,
        },
    }


def iot_mission_summary(session: Session, mission_id: str) -> str | None:
    """Human-readable IoT mission summary for exports."""
    from app.services import mission_service

    mission = mission_service.get_mission(session, mission_id)
    if mission is None or not mission.id.startswith("mission-iot"):
        return None

    tasks = task_service.list_tasks_for_mission(session, mission_id)
    iot_tasks = [t for t in tasks if t.plugin in IOT_PLUGINS]
    if not iot_tasks:
        return None

    ok = sum(1 for t in iot_tasks if t.status == TaskStatus.SUCCESS)
    if mission.id == "mission-iot-led-proof":
        return (
            f"LED Proof Mission successfully toggled simulated actuator led-001 "
            f"({ok}/{len(iot_tasks)} steps ok)"
        )
    if mission.id == "mission-iot-environmental":
        reads = sum(1 for t in iot_tasks if t.plugin.startswith("read_") and t.status == TaskStatus.SUCCESS)
        return f"Environmental Snapshot collected {reads} simulated sensor readings"
    if mission.id == "mission-iot-lab-health":
        return f"IoT Lab Health Check completed on gateway ({ok}/{len(iot_tasks)} checks ok)"
    if mission.id == "mission-iot-hybrid":
        return f"Hybrid mission executed computer + IoT steps ({ok}/{len(iot_tasks)} IoT steps ok)"
    return f"IoT mission completed ({ok}/{len(iot_tasks)} steps ok)"


def parse_led_state(devices: list[dict[str, Any]]) -> dict[str, Any]:
    for dev in devices:
        if dev.get("device_id") == "led-001":
            return dev.get("state") or {}
    return {"on": False, "brightness": 0, "blinking": False}
