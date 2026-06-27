# Aligo Mission Ledger C2

Plataforma C2 (Command & Control) de **laboratorio autorizado** con ledger blockchain de
**prueba de ejecución**. Desarrollada para la hackathon **Aligo Defensores Informáticos**.

Orquesta nodos modulares con plugins seguros, misiones reutilizables, evidencia verificable
anclada on-chain y un agente de IA que propone misiones bajo aprobación humana.

> **Uso exclusivo en laboratorio cerrado y autorizado.** No es malware ni herramienta ofensiva.
> Ver [`docs/seguridad.md`](docs/seguridad.md).

## Requisitos

- Python 3.12+
- Node.js 20+ y npm

## Inicio rápido

```bash
cp .env.example .env
python dev.py
```

Eso levanta la cadena Hardhat, despliega el contrato, el servidor API, el frontend, nodos
simulados y el gateway IoT. Abre:

- **Dashboard:** https://127.0.0.1:5173
- **API (Swagger):** https://127.0.0.1:8000/docs

Opciones útiles: `python dev.py --no-tls`, `python dev.py --no-iot`, `python dev.py --help`.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [**Guía completa**](docs/GUIA_COMPLETA.md) | Documento técnico para jurados — arquitectura, ledger, agente, IoT, vulnerabilidades |
| [Arquitectura](docs/arquitectura.md) | Componentes, flujos y protocolo WebSocket |
| [Ledger](docs/ledger.md) | Prueba de ejecución, hashing, anclaje y verificación |
| [Nodos](docs/nodos.md) | Registro, políticas y salud |
| [IoT](docs/iot.md) | Gateway simulado, sensores y actuadores |
| [Vulnerabilidades](docs/vulnerabilidades.md) | Escaneo lab-safe + OSINT |
| [Evidencia](docs/evidencia.md) | Modal de evidencia, consola, reportes y demo de alteración |
| [Seguridad](docs/seguridad.md) | Modelo de amenazas, límites y ética |
| [Despliegue](docs/despliegue.md) | Local, Docker y Google Cloud |
| [Demo](docs/demo.md) | Guión de presentación (~5 min) |
| [Agente IA](agents/orchestrator/README.md) | Orquestador Claude (Console → Ask AI) |

## Equipo UNcontrolled

- Yulian Bedoya
- Alejandro Feria
- Marycielo Berrio
- Juan Fernando Quintero
- Yulieth Urrego
