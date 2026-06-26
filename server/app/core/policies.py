"""Predefined node execution policies (lab-safe plugin subsets)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NodePolicy:
    id: str
    name: str
    description: str
    plugins: frozenset[str]


NODE_POLICIES: dict[str, NodePolicy] = {
    "basic_safe": NodePolicy(
        id="basic_safe",
        name="Basic Safe Node",
        description="Minimal read-only checks suitable for any lab node.",
        plugins=frozenset({"health_check", "system_info", "echo"}),
    ),
    "lab_file_audit": NodePolicy(
        id="lab_file_audit",
        name="Lab File Audit",
        description="Health and system probes plus sandboxed lab directory listing.",
        plugins=frozenset({"health_check", "system_info", "list_lab_directory"}),
    ),
    "demo_full": NodePolicy(
        id="demo_full",
        name="Demo Full",
        description="Full demo allowlist including network info and vetted commands.",
        plugins=frozenset(
            {
                "health_check",
                "system_info",
                "network_info",
                "list_lab_directory",
                "allowed_command",
            }
        ),
    ),
    "iot_demo_policy": NodePolicy(
        id="iot_demo_policy",
        name="IoT Demo Policy",
        description="Safe simulated IoT gateway plugins for lab sensors and actuators.",
        plugins=frozenset(
            {
                "gateway_health",
                "list_devices",
                "get_device_info",
                "get_gateway_snapshot",
                "read_temperature",
                "read_humidity",
                "read_motion",
                "read_light",
                "led_on",
                "led_off",
                "led_blink",
                "led_set_brightness",
            }
        ),
    ),
}

DEFAULT_POLICY_ID = "basic_safe"
