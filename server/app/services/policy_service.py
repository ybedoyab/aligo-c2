"""Node execution policy helpers and decision records."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.enums import ALLOWED_PLUGINS, PolicyDecision
from app.core.policies import NODE_POLICIES, NodePolicy
from app.models.node import Node
from app.schemas.node import PolicyRead
from app.websocket.manager import manager


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def list_policies() -> list[PolicyRead]:
    return [
        PolicyRead(
            id=p.id,
            name=p.name,
            description=p.description,
            plugins=sorted(p.plugins),
        )
        for p in NODE_POLICIES.values()
    ]


def get_policy(policy_id: str) -> NodePolicy | None:
    return NODE_POLICIES.get(policy_id)


def plugin_allowed(node: Node | None, plugin: str) -> bool:
    if node is None or not node.enabled:
        return False
    policy = NODE_POLICIES.get(node.policy_id)
    if policy is None:
        return False
    return plugin in policy.plugins


def evaluate_policy(
    node: Node | None,
    plugin: str,
    *,
    node_id: str,
    require_online: bool = False,
    require_trusted: bool = False,
) -> dict[str, Any]:
    """Build a Policy Decision Record before task dispatch."""
    rules: list[dict[str, Any]] = []
    reasons: list[str] = []

    if plugin not in ALLOWED_PLUGINS:
        rules.append({"rule": "global_plugin_allowlist", "pass": False})
        reasons.append(f"plugin '{plugin}' not in global allowlist")
    else:
        rules.append({"rule": "global_plugin_allowlist", "pass": True})

    if node is None:
        rules.append({"rule": "node_registered", "pass": False})
        reasons.append("node not found in registry")
    else:
        rules.append({"rule": "node_registered", "pass": True})

        if not node.enabled:
            rules.append({"rule": "node_enabled", "pass": False})
            reasons.append("node is disabled")
        else:
            rules.append({"rule": "node_enabled", "pass": True})

        if require_trusted and not node.trusted:
            rules.append({"rule": "node_trusted", "pass": False})
            reasons.append("node is marked untrusted")
        else:
            rules.append({"rule": "node_trusted", "pass": True})

        policy = NODE_POLICIES.get(node.policy_id)
        if policy and plugin in policy.plugins:
            rules.append({"rule": "plugin_in_policy", "pass": True})
        else:
            rules.append({"rule": "plugin_in_policy", "pass": False})
            pid = node.policy_id if node else "unknown"
            reasons.append(f"plugin '{plugin}' not allowed by policy '{pid}'")

    online = manager.is_node_connected(node_id)
    if require_online and not online:
        rules.append({"rule": "node_online", "pass": False})
        reasons.append("node is not connected")
    else:
        rules.append({"rule": "node_online", "pass": online})

    decision = (
        PolicyDecision.BLOCK
        if any(not r["pass"] for r in rules)
        else PolicyDecision.ALLOW
    )
    return {
        "decision": str(decision),
        "policy_id": node.policy_id if node else None,
        "node_id": node_id,
        "plugin": plugin,
        "reason": "; ".join(reasons) if reasons else "all rules passed",
        "evaluated_rules": rules,
        "timestamp": _utcnow_iso(),
    }
