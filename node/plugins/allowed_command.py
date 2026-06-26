"""allowed_command plugin: run ONLY a fixed allowlist of harmless informational commands.

There is no free-form shell. The operator may not pass arbitrary commands or arguments;
only the exact command names below are accepted, and each is implemented natively (no
shell interpolation) so behavior is deterministic and cross-platform.
"""

from __future__ import annotations

import getpass
import os
import socket
from datetime import datetime, timezone
from typing import Any

# The only commands this node will ever "run".
ALLOWLIST: frozenset[str] = frozenset({"whoami", "hostname", "pwd", "date"})


def _execute(command: str) -> str:
    if command == "whoami":
        return getpass.getuser()
    if command == "hostname":
        return socket.gethostname()
    if command == "pwd":
        return os.getcwd()
    if command == "date":
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    raise ValueError(f"command '{command}' is not allowed")


def run(args: dict[str, Any]) -> dict[str, Any]:
    command = str(args.get("command", "")).strip().lower()
    if command not in ALLOWLIST:
        raise ValueError(
            f"command '{command}' is not in the allowlist {sorted(ALLOWLIST)}"
        )
    output = _execute(command)
    return {
        "command": command,
        "output": output,
        "allowlist": sorted(ALLOWLIST),
    }
