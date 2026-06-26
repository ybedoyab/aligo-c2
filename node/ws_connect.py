"""WebSocket connect helper with optional TLS for lab self-signed certs."""

from __future__ import annotations

import ssl
from typing import Any

import websockets


def lab_ssl_context(ws_url: str) -> ssl.SSLContext | None:
    """Return a permissive TLS context for wss:// lab URLs (self-signed)."""
    if not ws_url.lower().startswith("wss:"):
        return None
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def connect_ws(ws_url: str, max_size: int, **kwargs: Any) -> Any:
    """websockets.connect with lab TLS when the URL uses wss://."""
    ssl_ctx = lab_ssl_context(ws_url)
    if ssl_ctx is not None:
        kwargs.setdefault("ssl", ssl_ctx)
    return websockets.connect(ws_url, max_size=max_size, **kwargs)
