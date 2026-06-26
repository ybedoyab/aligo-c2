"""Stable Ed25519 node identity for signing task results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


IDENTITIES_DIR = Path(__file__).resolve().parent / "identities"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def identity_path(node_id: str) -> Path:
    IDENTITIES_DIR.mkdir(parents=True, exist_ok=True)
    safe = node_id.replace("/", "_").replace("\\", "_")
    return IDENTITIES_DIR / f"{safe}.json"


def load_or_create_identity(node_id: str) -> dict[str, str]:
    path = identity_path(node_id)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        return {
            "node_id": data["node_id"],
            "public_key": data["public_key"],
            "private_key": data["private_key"],
        }

    private_key = Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes_raw()
    public_bytes = private_key.public_key().public_bytes_raw()
    record = {
        "node_id": node_id,
        "public_key": public_bytes.hex(),
        "private_key": private_bytes.hex(),
        "created_at": _utcnow_iso(),
    }
    path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return {
        "node_id": node_id,
        "public_key": record["public_key"],
        "private_key": record["private_key"],
    }
