"""Canonical JSON serialization and SHA-256 hashing for ledger events.

The hash is the cornerstone of the Proof-of-Execution Ledger: the exact same bytes
must be reproducible from the stored event so that integrity can be re-verified later.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(payload: dict[str, Any]) -> str:
    """Serialize a dict to a deterministic, canonical JSON string.

    Rules: keys sorted, no insignificant whitespace, UTF-8, non-ASCII preserved.
    Two semantically equal payloads always produce identical bytes.
    """
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_hex(data: str) -> str:
    """Return the hex-encoded SHA-256 digest of a string (UTF-8 encoded)."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hash_payload(payload: dict[str, Any]) -> str:
    """Compute the canonical SHA-256 hash (hex) of a payload dict."""
    return sha256_hex(canonical_json(payload))


def to_bytes32(hex_digest: str) -> bytes:
    """Convert a 64-char hex SHA-256 digest into 32 raw bytes for on-chain storage."""
    cleaned = hex_digest[2:] if hex_digest.startswith("0x") else hex_digest
    return bytes.fromhex(cleaned)


GENESIS_HASH = "0" * 64
"""Sentinel previous_hash used for the very first event in the chain."""
