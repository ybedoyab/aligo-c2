"""Simulated subdevice state for the IoT gateway lab."""

from __future__ import annotations

import random
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@dataclass
class SubDevice:
    device_id: str
    device_type: str  # actuator | sensor
    label: str
    state: dict[str, Any] = field(default_factory=dict)
    last_updated: str = field(default_factory=_utcnow_iso)

    def to_dict(self) -> dict[str, Any]:
        return {
            "device_id": self.device_id,
            "device_type": self.device_type,
            "label": self.label,
            "state": dict(self.state),
            "last_updated": self.last_updated,
            "status": "simulated",
        }

    def touch(self) -> None:
        self.last_updated = _utcnow_iso()


class GatewayDeviceStore:
    """In-memory simulated devices managed by the gateway."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._devices: dict[str, SubDevice] = {
            "led-001": SubDevice(
                "led-001",
                "actuator",
                "LED-001",
                {"on": False, "brightness": 0, "blinking": False},
            ),
            "temp-001": SubDevice(
                "temp-001",
                "sensor",
                "Temperature",
                {"temperature_c": 22.5},
            ),
            "humidity-001": SubDevice(
                "humidity-001",
                "sensor",
                "Humidity",
                {"humidity_pct": 48.0},
            ),
            "motion-001": SubDevice(
                "motion-001",
                "sensor",
                "Motion",
                {"motion_detected": False},
            ),
            "light-001": SubDevice(
                "light-001",
                "sensor",
                "Ambient Light",
                {"lux": 320.0},
            ),
        }
        self._blink_until = 0.0
        self._telemetry_running = False

    def list_devices(self) -> list[dict[str, Any]]:
        with self._lock:
            return [d.to_dict() for d in self._devices.values()]

    def get_device(self, device_id: str) -> SubDevice | None:
        with self._lock:
            return self._devices.get(device_id)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "devices": [d.to_dict() for d in self._devices.values()],
                "captured_at": _utcnow_iso(),
            }

    def tick_telemetry(self) -> None:
        with self._lock:
            temp = self._devices["temp-001"]
            temp.state["temperature_c"] = round(
                float(temp.state.get("temperature_c", 22.0)) + random.uniform(-0.15, 0.15),
                2,
            )
            temp.touch()

            hum = self._devices["humidity-001"]
            hum.state["humidity_pct"] = round(
                min(99, max(10, float(hum.state.get("humidity_pct", 48)) + random.uniform(-0.5, 0.5))),
                1,
            )
            hum.touch()

            if random.random() < 0.08:
                motion = self._devices["motion-001"]
                motion.state["motion_detected"] = not motion.state.get("motion_detected", False)
                motion.touch()

            light = self._devices["light-001"]
            light.state["lux"] = round(
                max(0, float(light.state.get("lux", 300)) + random.uniform(-8, 8)),
                1,
            )
            light.touch()

            led = self._devices["led-001"]
            now = time.time()
            if led.state.get("blinking") and now < self._blink_until:
                led.state["on"] = not led.state.get("on", False)
                led.touch()
            elif led.state.get("blinking") and now >= self._blink_until:
                led.state["blinking"] = False
                led.state["on"] = False
                led.state["brightness"] = 0
                led.touch()

    def start_telemetry_loop(self, interval: float = 2.0) -> None:
        if self._telemetry_running:
            return
        self._telemetry_running = True

        def _loop() -> None:
            while self._telemetry_running:
                self.tick_telemetry()
                time.sleep(interval)

        threading.Thread(target=_loop, daemon=True).start()

    def led_on(self, device_id: str, brightness: int = 100) -> dict[str, Any]:
        dev = self._require(device_id, "actuator")
        with self._lock:
            dev.state["on"] = True
            dev.state["brightness"] = max(0, min(100, brightness))
            dev.state["blinking"] = False
            dev.touch()
            return dev.to_dict()

    def led_off(self, device_id: str) -> dict[str, Any]:
        dev = self._require(device_id, "actuator")
        with self._lock:
            dev.state["on"] = False
            dev.state["brightness"] = 0
            dev.state["blinking"] = False
            dev.touch()
            return dev.to_dict()

    def led_blink(
        self, device_id: str, duration_ms: int = 2000, interval_ms: int = 250
    ) -> dict[str, Any]:
        dev = self._require(device_id, "actuator")
        with self._lock:
            dev.state["blinking"] = True
            dev.state["on"] = True
            dev.state["brightness"] = 80
            self._blink_until = time.time() + duration_ms / 1000.0
            dev.touch()
            return {**dev.to_dict(), "blink_duration_ms": duration_ms, "interval_ms": interval_ms}

    def led_set_brightness(self, device_id: str, brightness: int) -> dict[str, Any]:
        return self.led_on(device_id, brightness)

    def read_sensor(self, device_id: str) -> dict[str, Any]:
        dev = self.get_device(device_id)
        if dev is None:
            raise ValueError(f"unknown device: {device_id}")
        if dev.device_type != "sensor":
            raise ValueError(f"{device_id} is not a sensor")
        with self._lock:
            dev.touch()
            return dev.to_dict()

    def _require(self, device_id: str, kind: str) -> SubDevice:
        dev = self.get_device(device_id)
        if dev is None:
            raise ValueError(f"unknown device: {device_id}")
        if dev.device_type != kind:
            raise ValueError(f"{device_id} is not a {kind}")
        return dev


STORE = GatewayDeviceStore()
