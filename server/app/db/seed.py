"""Seed predefined missions so the dashboard and demo work out of the box."""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.enums import MissionStatus
from app.db.database import engine
from app.models.mission import Mission

PREDEFINED_MISSIONS: list[dict] = [
    {
        "id": "mission-lab-health-check",
        "name": "Lab Health Check",
        "description": "Verify each node is healthy and report basic system info.",
        "steps": [
            {"plugin": "health_check", "args": {}},
            {"plugin": "system_info", "args": {}},
        ],
    },
    {
        "id": "mission-basic-recon",
        "name": "Basic Recon",
        "description": "Collect safe, local system and network information.",
        "steps": [
            {"plugin": "system_info", "args": {}},
            {"plugin": "network_info", "args": {}},
        ],
    },
    {
        "id": "mission-directory-audit",
        "name": "Directory Audit",
        "description": "List the contents of each node's sandboxed lab workspace.",
        "steps": [
            {"plugin": "list_lab_directory", "args": {"path": "."}},
        ],
    },
    {
        "id": "mission-multi-node-ping",
        "name": "Multi-Node Ping",
        "description": "Echo a ping and confirm health across every selected node.",
        "steps": [
            {"plugin": "echo", "args": {"text": "ping"}},
            {"plugin": "health_check", "args": {}},
        ],
    },
    {
        "id": "mission-iot-lab-health",
        "name": "IoT Lab Health Check",
        "description": "Verify the simulated IoT gateway and enumerate subdevices.",
        "steps": [
            {"plugin": "gateway_health", "args": {}},
            {"plugin": "list_devices", "args": {}},
            {"plugin": "get_gateway_snapshot", "args": {}},
        ],
    },
    {
        "id": "mission-iot-environmental",
        "name": "Environmental Snapshot",
        "description": "Read temperature, humidity, motion, and light from simulated sensors.",
        "steps": [
            {"plugin": "read_temperature", "args": {"device_id": "temp-001"}},
            {"plugin": "read_humidity", "args": {"device_id": "humidity-001"}},
            {"plugin": "read_motion", "args": {"device_id": "motion-001"}},
            {"plugin": "read_light", "args": {"device_id": "light-001"}},
        ],
    },
    {
        "id": "mission-iot-led-proof",
        "name": "LED Proof Mission",
        "description": "Demonstrate verifiable actuator control on simulated LED-001.",
        "steps": [
            {"plugin": "led_on", "args": {"device_id": "led-001"}},
            {
                "plugin": "led_blink",
                "args": {"device_id": "led-001", "duration_ms": 2000, "interval_ms": 250},
            },
            {"plugin": "led_off", "args": {"device_id": "led-001"}},
        ],
    },
    {
        "id": "mission-iot-hybrid",
        "name": "Hybrid Mission",
        "description": "Combine computer node health check with IoT gateway orchestration.",
        "steps": [
            {"plugin": "health_check", "node_id": "node-001", "args": {}},
            {"plugin": "gateway_health", "node_id": "gateway-sim-001", "args": {}},
            {
                "plugin": "read_temperature",
                "node_id": "gateway-sim-001",
                "args": {"device_id": "temp-001"},
            },
            {
                "plugin": "led_blink",
                "node_id": "gateway-sim-001",
                "args": {
                    "device_id": "led-001",
                    "duration_ms": 2000,
                    "interval_ms": 250,
                },
            },
        ],
    },
]


def seed_predefined_missions() -> None:
    """Insert the predefined mission templates if they do not already exist."""
    with Session(engine) as session:
        for spec in PREDEFINED_MISSIONS:
            existing = session.get(Mission, spec["id"])
            if existing:
                continue
            mission = Mission(
                id=spec["id"],
                name=spec["name"],
                description=spec["description"],
                status=MissionStatus.DRAFT,
                steps=spec["steps"],
                target_node_ids=[],
                is_predefined=True,
            )
            session.add(mission)
        session.commit()
