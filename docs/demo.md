# Guión de demo (~5 min)

**Prerequisito:** `python dev.py` en marcha.

| Tiempo | Qué hacer | Qué decir |
|--------|-----------|-----------|
| 0:00 | Dashboard + estado de cadena en sidebar | "C2 de laboratorio con evidencia verificable on-chain. Solo plugins seguros." |
| 0:30 | **Topology** | "Operador, servidor, nodos modulares y contrato ExecutionLedger." |
| 1:00 | **Nodes** — 2–3 nodos online | "Heartbeats en vivo, políticas y puntuación de salud explicable." |
| 1:30 | **Missions** → Lab Health Check → ejecutar | "Misión reutilizable que despliega health_check + system_info en todos los nodos." |
| 2:30 | Clic en resultado → **evidencia** | "Paquete auditado: plugin, args, stdout, hash encadenado." |
| 3:00 | **Console** → `network_info` con política `basic_safe` | "Políticas bloquean plugins — PLUGIN_BLOCKED en el ledger." |
| 3:30 | **Ledger** → anclar pendientes → verificar | "Anclaje on-chain. Verified = integridad confirmada." |
| 4:00 | API tamper demo → verificar de nuevo | "Simulamos alteración local — el sistema marca tampered." |
| 4:30 | **Missions** → exportar reporte MD | "Dossier para el jurado con hashes y timeline." |
| 5:00 | **Vulnerabilities** (opcional) | "Recon lab-safe + OSINT server-side para hallazgos indicativos." |
| — | **IoT Lab** (opcional) | "Gateway simulado con el mismo modelo de evidencia." Ver [`iot.md`](iot.md). |

## Checklist pre-demo

- [ ] `/health` → `chain_status: connected`
- [ ] Nodos online (`dev.py` o `node.py --simulate-count 3`)
- [ ] Gateway IoT `gateway-sim-001` online (salvo `--no-iot`)

## Puntos para jurado

- Registro y políticas de nodos ([`nodos.md`](nodos.md))
- Evidencia y verificación ([`evidencia.md`](evidencia.md))
- Ledger no decorativo — se comprueba en vivo ([`ledger.md`](ledger.md))
- Seguridad por diseño ([`seguridad.md`](seguridad.md))
