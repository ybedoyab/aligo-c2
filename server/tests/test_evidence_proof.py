"""Tests for signing and Merkle evidence."""

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.merkle import build_merkle_tree, verify_merkle_proof
from app.core.signing import (
    build_signable_result_payload,
    fingerprint_from_public_key,
    signable_bytes,
    verify_result_signature,
)


def test_node_signature_roundtrip():
    key = Ed25519PrivateKey.generate()
    pub = key.public_key().public_bytes_raw().hex()
    priv = key.private_bytes_raw().hex()
    payload = build_signable_result_payload(
        task_id="task-abc",
        mission_id="mission-1",
        node_id="node-001",
        status="success",
        stdout='{"ok":true}',
        stderr="",
        exit_code=0,
        duration_ms=42,
        timestamp="2026-06-26T12:00:00Z",
    )
    sig = key.sign(signable_bytes(payload)).hex()
    assert verify_result_signature(pub, payload, sig)
    assert fingerprint_from_public_key(pub)


def test_merkle_proof():
    leaves = ["a" * 64, "b" * 64, "c" * 64]
    root, proofs = build_merkle_tree(leaves)
    assert verify_merkle_proof(leaves[0], proofs[0], root)
    assert verify_merkle_proof(leaves[1], proofs[1], root)
