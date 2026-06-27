# Despliegue

## Puertos

| Servicio | Puerto |
|----------|--------|
| C2 API | 8000 |
| Frontend | 5173 |
| Agente (opcional) | 8100 |
| Hardhat (interno) | 8545 |

## Local — recomendado (un comando)

```bash
cp .env.example .env
python dev.py
```

Levanta cadena Hardhat, contrato, API, frontend, nodos simulados y **gateway IoT** (`gateway-sim-001`).

- Dashboard: https://127.0.0.1:5173  
- API: https://127.0.0.1:8000/docs  

Opciones: `python dev.py --no-tls`, `python dev.py --no-iot`, `python dev.py --help`.

## Local — terminales separadas

Prerrequisitos: Python 3.12+, Node.js 20+.

### Terminal 1 — Blockchain

```bash
cd blockchain
npm install
npx hardhat node
```

### Terminal 2 — Desplegar contrato

```bash
cd blockchain
npx hardhat run scripts/deploy.ts --network localhost
```

Copia la dirección impresa a `.env` como `CONTRACT_ADDRESS=` (o deja que `deployment.json` la resuelva).

### Terminal 3 — Servidor API

```bash
cd server
python -m pip install -r requirements.txt
# En .env: BLOCKCHAIN_RPC_URL=http://localhost:8545
uvicorn app.main:app --reload --port 8000
```

### Terminal 4 — Frontend

```bash
cd frontend
npm install
npm run dev
```

### Terminal 5 — Nodos

```bash
cd node
python -m pip install -r requirements.txt
python node.py --simulate-count 3
```

### Terminal 6 — Gateway IoT (simulado)

```bash
cd node
python iot_gateway.py --gateway-id gateway-sim-001
```

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Servicios: `blockchain`, `server`, `frontend`, `node-1`, `node-2`, **`iot-gateway`**.

Después del primer arranque:

```bash
docker compose exec blockchain npx hardhat run scripts/deploy.ts --network localhost
```

Pon `CONTRACT_ADDRESS` en `.env` y reinicia el server:

```bash
docker compose up -d --no-deps server
```

## Google Cloud (demo en VM)

Una VM **Compute Engine** ejecuta el mismo `docker-compose` vía Terraform (`infrastructure/`).
No usa Cloud Run: Hardhat y los nodos WebSocket requieren procesos persistentes.

### Primera provisión

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars   # project_id obligatorio
terraform init
terraform plan
terraform apply
```

Seguimiento del bootstrap (~5–15 min):

```bash
gcloud compute ssh aligo-c2-vm --zone us-central1-a --project <PROJECT>
sudo tail -f /var/log/aligo-startup.log
# Listo cuando existe /opt/aligo-c2/READY
```

### Actualizar código (sin tocar blockchain)

En la VM, o vía SSH remoto:

```bash
sudo bash /opt/aligo-c2/infrastructure/update.sh main
```

Reconstruye `server`, `frontend`, `node-1`, `node-2`, **`iot-gateway`** y `agent` (si está activo)
sin recrear `aligo-blockchain` — preserva contrato y estado del ledger.

Desde tu PC:

```bash
gcloud compute ssh aligo-c2-vm --zone us-central1-a --project aligo-500700 \
  --command "sudo bash /opt/aligo-c2/infrastructure/update.sh main"
```

### URLs demo (IP estática)

| Servicio | URL |
|----------|-----|
| Dashboard | http://34.44.10.224:5173 |
| API docs | http://34.44.10.224:8000/docs |
| Agente | http://34.44.10.224:8100/health |

Detalle Terraform: [`infrastructure/README.md`](../infrastructure/README.md).

## Variables de entorno clave

Ver [`.env.example`](../.env.example). Las más usadas:

| Variable | Uso |
|----------|-----|
| `NODE_SHARED_TOKEN` | Token de registro de nodos |
| `CONTRACT_ADDRESS` | Contrato ExecutionLedger |
| `BLOCKCHAIN_RPC_URL` | RPC Hardhat (`http://localhost:8545` local, `http://blockchain:8545` Docker) |
| `FRONTEND_URL` | Origen CORS del dashboard |
| `ANTHROPIC_API_KEY` | Agente IA (opcional) |

## Troubleshooting

| Síntoma | Solución |
|---------|----------|
| Gateway IoT desconectado en cloud | Verificar contenedor `aligo-iot-gateway` (`docker ps`). Incluido en `docker-compose.yml` desde esta versión. |
| Ledger "local only" | Desplegar contrato; `CONTRACT_ADDRESS` en `.env`; reiniciar server |
| Nodos offline | Revisar `C2_WS_URL` y `NODE_SHARED_TOKEN` |
| `pending_chain` | Ledger → Anclar pendientes; o cadena reiniciada → sync |
| CORS | `FRONTEND_URL` / `PUBLIC_FRONTEND_URL` debe coincidir con el origen del navegador |
| Reset total | Borrar `server/c2.db`, artifacts de Hardhat, `deployment.json` |
