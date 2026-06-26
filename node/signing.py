"""Canonical result signing (mirrors server/app/core/signing.py)."""

from __future__ import annotations

import json
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def build_signable_result_payload(
    *,
    task_id: str,
    mission_id: str,
    node_id: str,
    status: str,
    stdout: str,
    stderr: str,
    exit_code: int,
    duration_ms: int,
    timestamp: str,
) -> dict[str, Any]:
    return {
        "task_id": task_id,
        "mission_id": mission_id,
        "node_id": node_id,
        "status": status,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
        "duration_ms": duration_ms,
        "timestamp": timestamp,
    }


def sign_result(private_key_hex: str, payload: dict[str, Any]) -> str:
    key_hex = private_key_hex[2:] if private_key_hex.startswith("0x") else private_key_hex
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(key_hex))
    sig = key.sign(canonical_json(payload).encode("utf-8"))
    return sig.hex()
