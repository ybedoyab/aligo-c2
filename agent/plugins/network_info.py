"""network_info plugin: report local hostname and basic interface info.

Does NOT scan external networks, ports, or other hosts.
"""

from __future__ import annotations

import socket
from typing import Any


def _primary_ip() -> str | None:
    """Determine the primary outbound IP without actually sending packets."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 192.0.2.0/24 is TEST-NET-1 (RFC 5737); no traffic leaves the host.
        sock.connect(("192.0.2.1", 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def run(args: dict[str, Any]) -> dict[str, Any]:
    hostname = socket.gethostname()
    addresses: list[str] = []
    try:
        _, _, ip_list = socket.gethostbyname_ex(hostname)
        addresses = sorted(set(ip_list))
    except OSError:
        addresses = []

    return {
        "hostname": hostname,
        "fqdn": socket.getfqdn(),
        "primary_ip": _primary_ip(),
        "host_addresses": addresses,
    }
