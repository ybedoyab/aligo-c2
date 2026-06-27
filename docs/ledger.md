# Ledger — prueba de ejecución

Cada evento importante se serializa a JSON canónico, se hashea (SHA-256), se encadena con
`previous_hash` y se ancla on-chain. La verificación detecta alteraciones posteriores.

## Por qué blockchain aquí

Un C2 tradicional guarda logs editables. Anclar el hash en una cadena append-only permite:

- **Evidencia de alteración** — cambiar stdout en BD rompe el hash vs on-chain → `tampered`
- **Segunda fuente de verdad** — independiente de la aplicación
- **Cadena de custodia** — `previous_hash` enlaza eventos en orden

## On-chain vs off-chain

| On-chain (`ExecutionLedger.sol`) | Base de datos |
|----------------------------------|---------------|
| `eventId`, hashes, metadatos mínimos | Payload canónico completo, stdout, tx_hash |

No se escribe salida cruda ni datos sensibles en la cadena.

## Cómo se calcula el hash

1. Dict canónico con `event_id`, `event_type`, `mission_id`, `task_id`, `node_id`, `data`,
   `previous_hash`, `timestamp`
2. JSON canónico (claves ordenadas, UTF-8)
3. SHA-256 → `payload_hash` → `registerEvent()` en el contrato

## Estados

| Estado UI | Significado |
|-----------|-------------|
| `verified` | Hash local = on-chain |
| `tampered` | Divergencia detectada |
| `pending_chain` | Aún no anclado o cadena no disponible |
| `local_only` | Ledger deshabilitado |

Cadena: `GET /api/ledger/status` → `connected`, `contract_not_configured`, `disconnected`.

## Anclar pendientes

- **Ledger** → botón *Anclar eventos pendientes*
- `POST /api/ledger/anchor-pending`
- `POST /api/ledger/events/{id}/anchor`

`CONTRACT_ADDRESS` se lee de `.env` o `deployment.json`. Reiniciar el servidor tras desplegar.

## Verificación

`POST /api/ledger/events/{id}/verify`:

1. Recalcula hash desde el payload almacenado
2. Compara con hash guardado (tampering local)
3. Compara con hash on-chain (`verifyEventHash`)

## Contrato

`ExecutionLedger.sol`: `registerEvent`, `getEvent`, `verifyEventHash`, `eventExists`.

## Limitaciones

- Cadena Hardhat local — demo, no red pública
- Reiniciar Hardhat borra estado on-chain; usar `/api/ledger/sync` o re-anclar
- Clave de firma en `.env` es la cuenta #0 de Hardhat (solo laboratorio)

Ver también [`seguridad.md`](seguridad.md).
