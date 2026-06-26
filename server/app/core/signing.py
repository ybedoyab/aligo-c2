"""Canonical result signing for node execution evidence."""

from __future__ import annotations

from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.core.hashing import canonical_json, hash_payload, sha256_hex


def fingerprint_from_public_key(public_key_hex: str) -> str:
    """Stable node fingerprint derived from the Ed25519 public key."""
    cleaned = public_key_hex.strip().lower()
    if cleaned.startswith("0x"):
        cleaned = cleaned[2:]
    return sha256_hex(cleaned)


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
    """Deterministic payload signed by the node (must match node/signing.py)."""
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


def signable_bytes(payload: dict[str, Any]) -> bytes:
    return canonical_json(payload).encode("utf-8")


def verify_result_signature(
    public_key_hex: str, payload: dict[str, Any], signature_hex: str
) -> bool:
    if not public_key_hex or not signature_hex:
        return False
    try:
        pub = public_key_hex[2:] if public_key_hex.startswith("0x") else public_key_hex
        sig = signature_hex[2:] if signature_hex.startswith("0x") else signature_hex
        key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub))
        key.verify(bytes.fromhex(sig), signable_bytes(payload))
        return True
    except (InvalidSignature, ValueError):
        return False


def result_payload_hash(payload: dict[str, Any]) -> str:
    return hash_payload(payload)
