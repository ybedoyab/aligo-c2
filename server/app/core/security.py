"""Lab-grade security helpers.

NOTE: This is intentionally simple shared-token auth suitable for an authorized lab
environment only. It is NOT a substitute for real PKI / mutual TLS. See docs/security.md.
"""

from __future__ import annotations

import hmac

from .config import settings


def verify_agent_token(token: str | None) -> bool:
    """Constant-time comparison of an agent-supplied token against the shared secret."""
    if not token:
        return False
    return hmac.compare_digest(token, settings.agent_shared_token)
