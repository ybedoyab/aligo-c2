# Seguridad y limitaciones

## Modelo de amenazas (laboratorio)

Entorno controlado con operadores de confianza. Objetivos:

- **Contención** — el nodo no es un shell remoto
- **Integridad** — resultados auditables y verificables
- **Robustez** — entrada malformada no tumba el servidor

Fuera de alcance: adversarios nation-state, PKI real, multi-tenant, capacidades ofensivas.

## Decisiones de diseño

### Sin shell arbitrario

Solo plugins del registro fijo (`node/plugins/`). `allowed_command` permite únicamente
`whoami`, `hostname`, `pwd`, `date` — sin invocar shell del SO.

### Allowlist en tres capas

1. Validación Pydantic en creación de misión/tarea (`ALLOWED_PLUGINS`)
2. Registro de plugins en el nodo
3. **Políticas por nodo** — subconjunto adicional ([`nodos.md`](nodos.md))

### Sandbox y validación

- `list_lab_directory` confinado a `node/lab_workspace/`
- WebSocket con límite de tamaño; timeouts por tarea (30 s)
- CORS restringido a orígenes del frontend

### Autenticación de nodos

Token compartido `NODE_SHARED_TOKEN` (comparación en tiempo constante). **No** es PKI/mTLS.

### TLS en desarrollo

`python dev.py` usa HTTPS/WSS con certificado autofirmado (`.dev/certs/`). `--no-tls` para
debug. Docker y cloud usan HTTP salvo terminación TLS externa.

### Agente IA

Cliente de la misma API que el operador humano. Herramientas con compuerta requieren
aprobación en el dashboard. Misma allowlist de plugins.

## Lo que este proyecto NO hace

Sin malware, evasión, persistencia, bypass AV, movimiento lateral real, escaneo ofensivo,
robo de credenciales ni exfiltración. Uso solo en laboratorio **autorizado**.

## Limitaciones honestas

| Tema | Detalle |
|------|---------|
| Producción | Demo de hackathon; sin hardening formal |
| Blockchain | Hardhat local; reinicio borra anclas on-chain |
| Token | Estático y simétrico; quien lo tenga puede registrar nodos |
| SQLite | Por defecto; PostgreSQL vía `DATABASE_URL` |
| Escala | Un proceso servidor; sin balanceo horizontal |
| Plugins | Lista corta e intencionalmente limitada |

## Ética

Responsabilidad del operador de contar con permiso explícito sobre cualquier sistema
involucrado.
