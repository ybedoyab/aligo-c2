# Aligo Mission Ledger C2

Plataforma de laboratorio para orquestar nodos, misiones y evidencia de ejecución con ledger blockchain. Uso autorizado en entorno controlado únicamente.

## Requisitos

- Python 3.12+
- Node.js 20+ y npm

## Inicio rápido

```bash
cp .env.example .env
# (opcional) pega tu ANTHROPIC_API_KEY en .env para habilitar el chat con el agente IA
python dev.py
```

Eso levanta la aplicación completa: blockchain, contrato, API, **agente IA**, dashboard, nodos simulados y gateway IoT. El canal operador↔servidor y nodo↔servidor va cifrado con **TLS/WSS** (certificado autofirmado de laboratorio; el navegador pedirá aceptarlo una vez).

```bash
python dev.py --no-tls    # solo depuración: HTTP/WS sin cifrar
```

| Servicio   | URL                          |
|------------|------------------------------|
| Dashboard  | http://localhost:5173        |
| API        | http://localhost:8000        |
| API docs   | http://localhost:8000/docs   |
| Agente IA  | http://localhost:8100/health |

Detener con `Ctrl+C`.

> **Agente IA (Console → Ask AI).** `dev.py` arranca el orquestrador (`agents/orchestrator`) en el puerto 8100 y el dashboard lo consume por proxy. Pega `ANTHROPIC_API_KEY` en `.env` antes de arrancar; sin clave el stack funciona igual y la consola manual sigue operativa, solo se desactiva el chat. El agente solo propone plugins de la allowlist y **ejecuta únicamente tras tu aprobación**. Detalle en [`agents/orchestrator/README.md`](agents/orchestrator/README.md).

## Guía rápida en la app

| Tema | Dónde | Documentación |
|------|-------|---------------|
| Nodos | **Nodes** → detalle del nodo | [node-registry.md](docs/node-registry.md) |
| Políticas | **Node Detail**, **Console** | [node-policies.md](docs/node-policies.md) |
| Misiones y evidencia | **Missions**, modal de evidencia | [task-evidence.md](docs/task-evidence.md) |
| Exportar informe | **Missions** o **Demo** | [mission-report.md](docs/mission-report.md) |
| Ledger y verificación | **Ledger**, **Demo → Verify** | [blockchain-ledger.md](docs/blockchain-ledger.md) |
| Demo de tamper | **Demo → Simulate tamper** | [tamper-demo.md](docs/tamper-demo.md) |
| Topología | **Topology** | [topology.md](docs/topology.md) |
| IoT simulado | **IoT Lab**, **Demo** | [iot-simulation.md](docs/iot-simulation.md) |
| Consola | **Console** | [operator-console.md](docs/operator-console.md) |
| Script de demo | **Demo** | [demo-script.md](docs/demo-script.md) |

## Documentación general

Guía completa del proyecto (arquitectura, stack, flujos, pitch): [`docs/presentacion-general.md`](docs/presentacion-general.md).

Más documentación técnica en [`docs/`](docs/): [arquitectura](docs/architecture.md), [protocolo](docs/protocol.md), [seguridad](docs/security.md), [despliegue](docs/deployment.md), [limitaciones](docs/limitations.md).

## Aviso

Solo laboratorio autorizado. Plugins seguros en allowlist; sin shell remoto ni capacidades ofensivas. Ver [`docs/security.md`](docs/security.md).
