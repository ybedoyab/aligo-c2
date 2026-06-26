"""Node execution policy helpers."""

from __future__ import annotations

from app.core.policies import NODE_POLICIES, NodePolicy
from app.models.node import Node
from app.schemas.node import PolicyRead


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


def plugin_allowed(node: Node, plugin: str) -> bool:
    policy = NODE_POLICIES.get(node.policy_id)
    if policy is None:
        return False
    return plugin in policy.plugins
