# Simulated IoT integration

Mission Ledger C2 includes a **software-simulated IoT gateway** that connects to the C2 over the same WebSocket node channel used by computer nodes. No physical hardware is required.

## What is simulated vs real

| Layer | Real | Simulated |
|-------|------|-----------|
| C2 server, missions, tasks, ledger | ✓ | |
| WebSocket node transport | ✓ | |
| Gateway process (`iot_gateway.py`) | ✓ (software node) | |
| Subdevices (LED, sensors) | | ✓ in-memory state |
| Telemetry fluctuations | | ✓ background thread |
| On-chain evidence anchoring | ✓ | |

## Gateway model

The **gateway** (`gateway-sim-001`) is the only IoT node registered with the C2. Subdevices (`led-001`, `temp-001`, etc.) live inside the gateway process. The operator dispatches plugins to the gateway; the gateway routes device-level plugins using `device_id` in task args.

```
C2 Server → WebSocket → IoT Gateway Node → simulated subdevices
```

## Subdevices

| ID | Type | State |
|----|------|-------|
| led-001 | actuator | on/off, brightness, blinking |
| temp-001 | sensor | temperature_c |
| humidity-001 | sensor | humidity_pct |
| motion-001 | sensor | motion_detected |
| light-001 | sensor | lux |

Telemetry updates every ~2 seconds and is pushed via heartbeat `iot_snapshot`.

## Safe plugins

All IoT plugins are allowlisted and governed by the `iot_demo_policy`. See [`iot-architecture.md`](iot-architecture.md) for the full plugin list.

## Evidence

IoT task results include `metadata.evidence_type = iot_action`. The evidence modal shows gateway, subdevice, physical-style action, and `evidence_class: iot_action`. Ledger events anchor hashes the same way as computer node tasks.

## Running locally

```bash
python dev.py   # starts chain, API, frontend, computer nodes, and IoT gateway
```

Or manually:

```bash
python node/iot_gateway.py --gateway-id gateway-sim-001
```

Open **IoT Lab** in the dashboard for live telemetry and the circuit view.

## Demo missions

Preset missions in the Missions library:

- **IoT Lab Health Check** — gateway_health, list_devices, get_gateway_snapshot
- **Environmental Snapshot** — read all four sensors
- **LED Proof Mission** — led_on, led_blink, led_off on led-001
- **Hybrid Mission** — computer health_check + IoT steps (per-step `node_id`)

See [`iot-demo-script.md`](iot-demo-script.md) for a jury walkthrough.
