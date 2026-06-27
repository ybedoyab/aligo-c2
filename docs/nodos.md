# Nodos y políticas

## Registro de nodos

Un nodo aparece en el inventario cuando su proceso se conecta por WebSocket. No se fabrican
nodos desde la UI.

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador estable (`node-001`, `gateway-sim-001`) |
| `alias`, `tags`, `group` | Metadatos para filtrar y organizar |
| `node_type` | `real`, `simulated`, `ai_analyst` (placeholder) |
| `policy_id` | Política de ejecución asignada |
| `enabled` | Si es `false`, se rechazan tareas antes del dispatch |

**Salud (0–100):** heartbeat, tasa de éxito, latencia y errores recientes — desglose en
Node Detail.

Solo se pueden **eliminar** nodos offline (`DELETE /api/nodes/{id}`).

## Políticas predefinidas

| ID | Plugins permitidos |
|----|-------------------|
| `basic_safe` | `health_check`, `system_info`, `echo` |
| `lab_file_audit` | + `list_lab_directory` |
| `demo_full` | + `network_info`, `allowed_command` |
| `iot_demo_policy` | Plugins IoT del gateway |

Política por defecto: `basic_safe`. Se asigna en **Nodes → Node Detail**.

## Enforcement

Si un plugin no está permitido por la política del nodo:

- La tarea queda en `blocked_by_policy`
- Se emite evento de ledger `PLUGIN_BLOCKED`
- La API responde 403

**Demo rápida:** asignar `basic_safe` → intentar `network_info` desde Console → ver bloqueo
→ cambiar a `demo_full` → reintentar con éxito.

## API

```
GET/PATCH/DELETE  /api/nodes/{id}
GET             /api/nodes/{id}/health
GET             /api/policies
```
