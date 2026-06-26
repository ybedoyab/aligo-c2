# IoT architecture

## Why a gateway model?

Real IoT deployments often expose a **single gateway** to upstream systems while managing many edge devices locally. Simulating this pattern lets Mission Ledger C2 demonstrate orchestration beyond computer nodes without requiring hardware.

## Node types

| `node_type` | Role |
|-------------|------|
| `computer_node` | Standard lab node (simulated or real) |
| `iot_gateway` | Connected gateway; receives all IoT plugins |
| `iot_sensor` | Logical type for subdevices (UI/topology) |
| `iot_actuator` | Logical type for subdevices (UI/topology) |

The gateway registers with `node_type = iot_gateway` and policy `iot_demo_policy`.

## Message flow

1. Gateway sends `register` with `iot_snapshot` (initial device states).
2. Heartbeats include updated `iot_snapshot`; server persists to `nodes.iot_snapshot` / `nodes.iot_devices`.
3. Operator creates task (mission or quick action) targeting `gateway-sim-001`.
4. Server dispatches `task` over WebSocket.
5. Gateway runs plugin, signs result, sends `result` with `metadata.evidence_type = iot_action`.
6. Server records result, ledger event, and broadcasts to operator UI.

## Plugin routing

**Gateway-level** (no `device_id` required):

- `gateway_health`, `list_devices`, `get_device_info`, `get_gateway_snapshot`

**Device-level** (`device_id` in args):

- Sensors: `read_temperature`, `read_humidity`, `read_motion`, `read_light`
- Actuators: `led_on`, `led_off`, `led_blink`, `led_set_brightness`

## API surfaces

| Endpoint | Purpose |
|----------|---------|
| `GET /api/iot/lab` | Gateway summary, devices, telemetry, recent events |
| `POST /api/iot/actions` | Quick IoT task dispatch |
| Demo routes under `/api/demo/*` | Jury one-click IoT demos |

## Topology integration

The Topology page shows the IoT branch nested under the gateway with badges: gateway, sensor, actuator, simulated.

## Hybrid missions

Steps may include `node_id` to target specific nodes without cross-product expansion:

```json
{"plugin": "health_check", "node_id": "node-001", "args": {}},
{"plugin": "read_temperature", "node_id": "gateway-sim-001", "args": {"device_id": "temp-001"}}
```

Start hybrid missions with targets `[node-001, gateway-sim-001]`.

## Code layout

```
node/iot_gateway.py       # Gateway WebSocket client
node/iot_sim/devices.py   # In-memory device store + telemetry
node/iot_sim/plugins.py   # Plugin registry
server/app/services/iot_service.py
server/app/api/iot.py
frontend/src/pages/IoTLab.tsx
frontend/src/components/IoTCircuit.tsx
```
