"""IoT-safe plugin implementations for the simulated gateway."""

from __future__ import annotations

import time
from typing import Any, Callable

from iot_sim.devices import STORE

PluginFn = Callable[[dict[str, Any]], dict[str, Any]]


def gateway_health(_args: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "ok",
        "gateway_mode": "simulated",
        "device_count": len(STORE.list_devices()),
        "telemetry_active": True,
    }


def list_devices(_args: dict[str, Any]) -> dict[str, Any]:
    return {"devices": STORE.list_devices()}


def get_device_info(args: dict[str, Any]) -> dict[str, Any]:
    device_id = args.get("device_id", "")
    dev = STORE.get_device(device_id)
    if dev is None:
        raise ValueError(f"device not found: {device_id}")
    return dev.to_dict()


def get_gateway_snapshot(_args: dict[str, Any]) -> dict[str, Any]:
    return STORE.snapshot()


def read_temperature(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.read_sensor(args.get("device_id", "temp-001"))


def read_humidity(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.read_sensor(args.get("device_id", "humidity-001"))


def read_motion(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.read_sensor(args.get("device_id", "motion-001"))


def read_light(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.read_sensor(args.get("device_id", "light-001"))


def led_on(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.led_on(args.get("device_id", "led-001"), int(args.get("brightness", 100)))


def led_off(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.led_off(args.get("device_id", "led-001"))


def led_blink(args: dict[str, Any]) -> dict[str, Any]:
    device_id = args.get("device_id", "led-001")
    duration_ms = int(args.get("duration_ms", 2000))
    interval_ms = int(args.get("interval_ms", 250))
    result = STORE.led_blink(device_id, duration_ms, interval_ms)
    time.sleep(min(duration_ms, 3000) / 1000.0)
    return result


def led_set_brightness(args: dict[str, Any]) -> dict[str, Any]:
    return STORE.led_set_brightness(
        args.get("device_id", "led-001"), int(args.get("brightness", 50))
    )


IOT_REGISTRY: dict[str, PluginFn] = {
    "gateway_health": gateway_health,
    "list_devices": list_devices,
    "get_device_info": get_device_info,
    "get_gateway_snapshot": get_gateway_snapshot,
    "read_temperature": read_temperature,
    "read_humidity": read_humidity,
    "read_motion": read_motion,
    "read_light": read_light,
    "led_on": led_on,
    "led_off": led_off,
    "led_blink": led_blink,
    "led_set_brightness": led_set_brightness,
}


def available_iot_plugins() -> list[str]:
    return sorted(IOT_REGISTRY.keys())
