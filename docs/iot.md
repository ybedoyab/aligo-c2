# IoT simulado

Gateway software que se conecta al C2 por el mismo canal WebSocket que los nodos de cómputo.
No requiere hardware físico.

## Modelo gateway

```
C2 Server → WebSocket → gateway-sim-001 → subdispositivos en memoria
```

Solo el **gateway** se registra en el C2. Los subdispositivos viven dentro del proceso del
gateway; las tareas IoT van al gateway con `device_id` en los argumentos cuando aplica.

| ID | Tipo | Estado simulado |
|----|------|-----------------|
| `led-001` | actuador | on/off, brillo, parpadeo |
| `temp-001` | sensor | temperatura |
| `humidity-001` | sensor | humedad |
| `motion-001` | sensor | movimiento |
| `light-001` | sensor | lux |

La telemetría se actualiza ~cada 2 s y viaja en `iot_snapshot` del heartbeat.

## Plugins IoT

**Nivel gateway:** `gateway_health`, `list_devices`, `get_device_info`, `get_gateway_snapshot`

**Por dispositivo** (`device_id` en args):

- Sensores: `read_temperature`, `read_humidity`, `read_motion`, `read_light`
- Actuadores: `led_on`, `led_off`, `led_blink`, `led_set_brightness`

## UI y API

- **IoT Lab** — telemetría en vivo, vista de circuito, acciones rápidas (LED on/blink/off)
- **Topology** — rama IoT anidada bajo el gateway
- `GET /api/iot/lab` — resumen del laboratorio IoT
- `POST /api/iot/actions` — despacho rápido de tareas IoT

## Misiones de ejemplo

- **IoT Lab Health Check** — salud del gateway y listado de dispositivos
- **Environmental Snapshot** — lectura de los cuatro sensores
- **LED Proof Mission** — secuencia on → blink → off
- **Hybrid Mission** — pasos de cómputo + IoT con `node_id` por paso

## Misiones híbridas

```json
{"plugin": "health_check", "node_id": "node-001", "args": {}},
{"plugin": "read_temperature", "node_id": "gateway-sim-001", "args": {"device_id": "temp-001"}}
```

## Evidencia

Los resultados IoT incluyen `metadata.evidence_type = iot_action`. El modal de evidencia y
el ledger los tratan igual que las tareas de nodos de cómputo.

## Arranque

`python dev.py` inicia el gateway automáticamente. En Docker/cloud: servicio `iot-gateway` en `docker-compose.yml`.

## Nodo `ai_analyst` (placeholder)

Tipo de registro reservado para **futura** asistencia analítica (resúmenes, anomalías).
En esta build **no** hay APIs externas de IA en el nodo; el agente de orquestación vive en
`agents/orchestrator` y actúa como operador sobre la API del C2.

## Demo IoT (~3 min)

1. **Topology** — rama IoT vs nodos de cómputo.
2. **IoT Lab** — telemetría + circuito; encender y parpadear LED.
3. **Missions** → IoT Lab Health Check → **Ledger** → verificar evento.
4. Cierre: *"Mismo modelo C2 y ledger para gateways, sensores y actuadores simulados."*
