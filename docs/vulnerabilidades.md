# Vulnerabilidades (laboratorio)

Módulo **Vulnerabilities Issues** en el dashboard (`/vulnerabilities`). Ejecuta recon
lab-safe en nodos conectados y correlaciona hechos con OSINT **solo en el servidor** (los
nodos nunca hacen peticiones externas).

## Flujo

1. **Disparo** — botón *Run scan now* o cron diario (desactivado por defecto en config)
2. **Recon** — misión con plugins allowlist: `health_check`, `system_info`, `network_info`,
   `list_lab_directory`
3. **Hechos** — el servidor parsea stdout JSON por nodo
4. **OSINT** — NVD, OSV, CISA KEV, Hacker News, Stack Exchange, GitHub, Reddit, X (con
   degradación elegante sin API keys)
5. **Issues** — hallazgos con severidad, fuente y enlace de evidencia
6. **Reporte** — export JSON/Markdown

## Fuentes OSINT

| Fuente | Token | Notas |
|--------|-------|-------|
| NVD | Opcional | Búsqueda por palabra clave CVE |
| OSV | No | Paquete/versión Python, etc. |
| CISA KEV | No | CVE explotados conocidos → severidad crítica |
| Hacker News | No | Algolia |
| Stack Exchange Security | Opcional | |
| GitHub / GHSA | Opcional | Issues y advisories |
| Reddit | No | API pública |
| X | Opcional | Omitido si no hay token |

Los tokens son variables de entorno opcionales (no documentados en `.env.example`). Sin
tokens, NVD/OSV/KEV/HN/Reddit siguen funcionando con límites de tasa.

## Límites

- **No** es un escáner de puertos ni de explotación
- Resultados **indicativos** para conciencia del operador, no auditoría formal
- Respeta [`seguridad.md`](seguridad.md): sin escaneo agresivo ni exfiltración

## API

```
GET  /api/vulnerabilities/scans
POST /api/vulnerabilities/scans
GET  /api/vulnerabilities/issues
GET  /api/vulnerabilities/scans/{id}/report?format=json|markdown
```

WebSocket: `vulnerability_scan_update`, `vulnerability_issue`.

## Configuración (servidor)

Defaults en código: cron desactivado, intervalo 24 h. Tokens OSINT vía variables de entorno
si se desean fuentes con autenticación. Resumen narrativo opcional con `ANTHROPIC_API_KEY`.
