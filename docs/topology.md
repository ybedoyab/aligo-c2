# Topology View

The **Topology** page gives jurors a single diagram of how components connect in the lab.

## Components shown

```
Operator UI  →  C2 Server  →  Online Nodes  →  Blockchain Ledger
```

| Box | Description |
|-----|-------------|
| **Operator UI** | React dashboard (REST + `/ws/operator`) |
| **C2 Server** | FastAPI coordinator, SQLite/Postgres, ledger bridge |
| **Online nodes** | WebSocket-connected node processes with status + health |
| **Blockchain ledger** | Hardhat + `ExecutionLedger.sol` anchor target |

## Dashboard shortcut

The **Operations Dashboard** includes a compact **Fleet topology** strip with a link to the full page.

## Node cards

Each online node shows:

- Alias / id
- **online** badge
- OS and assigned policy
- Health score bar

Click a card to open **Node Detail**.

## Chain status

The server box displays live chain connectivity from `/health` (`connected`, `contract_not_configured`, etc.).

## Demo talking points

> "This is our lab map: operators use the UI, the server coordinates nodes over WebSocket, and every important execution event can be anchored to a private blockchain for verification."

## Related docs

- [Architecture](architecture.md)
- [Blockchain Ledger](blockchain-ledger.md)
- [Node Registry](node-registry.md)
