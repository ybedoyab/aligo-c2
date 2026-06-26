"""IoT plugin constants shared across server modules."""

from __future__ import annotations

IOT_PLUGINS: frozenset[str] = frozenset(
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
)

IOT_DEVICE_IDS = ("led-001", "temp-001", "humidity-001", "motion-001", "light-001")
DEFAULT_GATEWAY_ID = "gateway-sim-001"
