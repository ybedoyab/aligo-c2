"""Merkle tree utilities for mission evidence roots."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass


def _hash_pair(left: str, right: str) -> str:
    return hashlib.sha256(f"{left}{right}".encode("utf-8")).hexdigest()


def _next_pow2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


@dataclass
class _MerkleNode:
    hash: str
    leaf_index: int | None = None
    left: "_MerkleNode | None" = None
    right: "_MerkleNode | None" = None


def _build_node(hashes: list[str], indices: list[int]) -> _MerkleNode:
    if len(hashes) == 1:
        return _MerkleNode(hash=hashes[0], leaf_index=indices[0])
    mid = len(hashes) // 2
    left = _build_node(hashes[:mid], indices[:mid])
    right = _build_node(hashes[mid:], indices[mid:])
    return _MerkleNode(
        hash=_hash_pair(left.hash, right.hash),
        left=left,
        right=right,
    )


def _collect_proof(node: _MerkleNode, target: int, path: list[tuple[str, str]]) -> bool:
    if node.leaf_index is not None:
        return node.leaf_index == target
    assert node.left and node.right
    if _collect_proof(node.left, target, path):
        path.append(("right", node.right.hash))
        return True
    if _collect_proof(node.right, target, path):
        path.append(("left", node.left.hash))
        return True
    return False


def build_merkle_tree(
    leaves: list[str],
) -> tuple[str, dict[int, list[str]]]:
    if not leaves:
        return ("0" * 64, {})
    if len(leaves) == 1:
        return (leaves[0], {0: []})

    n = len(leaves)
    size = _next_pow2(n)
    padded = leaves + [leaves[-1]] * (size - n)
    indices = list(range(n)) + [n - 1] * (size - n)

    root = _build_node(padded, indices)
    proofs: dict[int, list[str]] = {}
    for i in range(n):
        path: list[tuple[str, str]] = []
        _collect_proof(root, i, path)
        proofs[i] = [f"{side}:{h}" for side, h in path]

    return (root.hash, proofs)


def verify_merkle_proof(leaf: str, proof: list[str], root: str) -> bool:
    current = leaf
    for entry in proof:
        if ":" in entry:
            side, sibling = entry.split(":", 1)
        else:
            side, sibling = "right", entry
        if side == "right":
            current = _hash_pair(current, sibling)
        else:
            current = _hash_pair(sibling, current)
    return current == root


def task_evidence_leaf(
    *,
    task_id: str,
    node_id: str,
    plugin: str,
    evidence_hash: str,
) -> str:
    from app.core.hashing import hash_payload

    return hash_payload(
        {
            "task_id": task_id,
            "node_id": node_id,
            "plugin": plugin,
            "evidence_hash": evidence_hash,
        }
    )
