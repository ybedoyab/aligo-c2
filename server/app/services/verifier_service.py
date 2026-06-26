"""Independent evidence bundle verification (no dashboard trust required)."""

from __future__ import annotations

import copy
from typing import Any

from app.blockchain.contract_client import get_contract_client
from app.core.enums import MerkleProofStatus, SignatureStatus, VerifierStatus
from app.core.hashing import hash_payload
from app.core.merkle import task_evidence_leaf, verify_merkle_proof
from app.core.signing import build_signable_result_payload, verify_result_signature


def _diff_dict(original: dict[str, Any], current: dict[str, Any]) -> list[dict[str, str]]:
    changes: list[dict[str, str]] = []
    keys = set(original) | set(current)
    for key in sorted(keys):
        o = original.get(key)
        c = current.get(key)
        if o != c:
            changes.append(
                {
                    "field": key,
                    "original": str(o)[:500],
                    "current": str(c)[:500],
                }
            )
    return changes


def verify_evidence_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """Verify a self-contained evidence JSON bundle offline-style."""
    checks: list[dict[str, Any]] = []
    status = VerifierStatus.VERIFIED

    task_id = bundle.get("task_id", "")
    local_hash = bundle.get("local_hash")
    anchored_snapshot = bundle.get("anchored_snapshot") or bundle.get("ledger_payload")
    current_payload = bundle.get("ledger_payload") or bundle.get("payload")

    # Local hash recomputation
    hash_ok = None
    if current_payload and isinstance(current_payload, dict):
        recomputed = hash_payload(current_payload)
        hash_ok = recomputed == local_hash
        checks.append(
            {
                "check": "local_hash",
                "pass": hash_ok,
                "detail": recomputed,
            }
        )
        if hash_ok is False:
            status = VerifierStatus.TAMPERED

    # Signature
    pub = bundle.get("node_public_key", "")
    sig = bundle.get("node_signature", "")
    sig_status = bundle.get("signature_status", SignatureStatus.MISSING)
    signable = bundle.get("signed_payload")
    if not signable and bundle.get("plugin"):
        signable = build_signable_result_payload(
            task_id=task_id,
            mission_id=bundle.get("mission_id", ""),
            node_id=bundle.get("node_id", ""),
            status=str(bundle.get("status", "")),
            stdout=bundle.get("stdout", ""),
            stderr=bundle.get("stderr", ""),
            exit_code=int(bundle.get("exit_code") or 0),
            duration_ms=int(bundle.get("duration_ms") or 0),
            timestamp=bundle.get("result_timestamp") or bundle.get("timestamp") or "",
        )
    sig_ok = None
    if pub and sig and signable:
        sig_ok = verify_result_signature(pub, signable, sig)
        checks.append({"check": "node_signature", "pass": sig_ok, "detail": sig_status})
        if sig_ok is False:
            status = VerifierStatus.SIGNATURE_INVALID
    elif sig_status == SignatureStatus.MISSING:
        checks.append({"check": "node_signature", "pass": None, "detail": "missing"})

    # On-chain
    ledger_event_id = bundle.get("ledger_event_id")
    chain_ok = None
    client = get_contract_client()
    if ledger_event_id and local_hash and client.available:
        onchain = client.get_onchain_hash(ledger_event_id)
        if onchain:
            normalized = onchain[2:] if onchain.startswith("0x") else onchain
            chain_ok = normalized.lower() == str(local_hash).lower()
            checks.append({"check": "on_chain_hash", "pass": chain_ok, "detail": onchain})
            if chain_ok is False:
                status = VerifierStatus.TAMPERED
        else:
            checks.append({"check": "on_chain_hash", "pass": False, "detail": "not on chain"})
            status = VerifierStatus.NOT_ANCHORED
    elif bundle.get("on_chain_status") in ("pending_chain", "disabled", None):
        if status == VerifierStatus.VERIFIED:
            status = VerifierStatus.NOT_ANCHORED
        checks.append({"check": "on_chain_hash", "pass": None, "detail": "not anchored"})

    # Merkle proof
    merkle_root = bundle.get("mission_merkle_root")
    merkle_proof = bundle.get("merkle_proof") or []
    evidence_hash = bundle.get("evidence_hash") or local_hash
    merkle_ok = None
    if merkle_root and evidence_hash and merkle_proof:
        leaf = task_evidence_leaf(
            task_id=task_id,
            node_id=bundle.get("node_id", ""),
            plugin=bundle.get("plugin", ""),
            evidence_hash=evidence_hash,
        )
        merkle_ok = verify_merkle_proof(leaf, merkle_proof, merkle_root)
        checks.append({"check": "merkle_proof", "pass": merkle_ok, "detail": merkle_root[:16]})
        if merkle_ok is False and status == VerifierStatus.VERIFIED:
            status = VerifierStatus.MERKLE_INVALID

    # Diff when tampered
    diff: list[dict[str, str]] = []
    if anchored_snapshot and current_payload:
        orig_data = anchored_snapshot.get("data") if isinstance(anchored_snapshot, dict) else {}
        cur_data = current_payload.get("data") if isinstance(current_payload, dict) else {}
        if orig_data and cur_data:
            diff = _diff_dict(orig_data, cur_data)

    if status == VerifierStatus.VERIFIED and not all(
        c.get("pass") is not False for c in checks if c.get("pass") is not None
    ):
        pass

    return {
        "status": str(status),
        "checks": checks,
        "diff": diff,
        "summary": {
            "task_id": task_id,
            "hash_valid": hash_ok,
            "signature_valid": sig_ok,
            "chain_valid": chain_ok,
            "merkle_valid": merkle_ok,
        },
    }
