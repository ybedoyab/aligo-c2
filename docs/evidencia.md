# Evidencia, consola y reportes

## Modal de evidencia de tarea

Cada fila de tarea/resultado abre el paquete de **prueba de ejecución**:

| Sección | Campos |
|---------|--------|
| Misión | nombre, id |
| Ejecución | nodo, plugin, args, estado |
| Salida | stdout, stderr, exit_code, duración |
| Integridad | `local_hash`, `previous_hash`, estado |
| On-chain | tx, bloque, `ledger_event_id` |

Acciones: **Verificar integridad**, copiar/exportar JSON, ir al evento en Ledger.

Estados: `verified`, `tampered`, `pending_chain`, `local_only`.

`GET /api/tasks/{id}/evidence`

## Consola del operador (`/console`)

Panel seguro — **no** es shell remoto. Solo plugins allowlist:

`health_check`, `system_info`, `network_info`, `list_lab_directory`, `echo`, `allowed_command`

Mini-lenguaje aceptado:

```text
run health_check on node-001
run system_info on all
```

Historial con enlace a evidencia por tarea.

## Reportes de misión

Desde **Missions** → Export JSON / Export MD por misión.

Incluye: metadatos, nodos, tareas, resultados, hashes del ledger, timeline y resumen.

`GET /api/missions/{id}/report?format=json|markdown`

## Demo de alteración (laboratorio)

Demuestra detección de manipulación:

1. Ejecutar misión con resultado exitoso
2. **Ledger** → anclar eventos pendientes
3. `POST /api/demo/simulate-tamper` con `{"task_id": "..."}`
4. Abrir evidencia → **Verificar** → estado `tampered`

Solo muta copia local para el hash; **no** modifica la cadena ni el nodo real.

> *"Si alguien alterara los logs locales, Verify muestra TAMPERED porque el hash ya no
> coincide con el registro inmutable on-chain."*
