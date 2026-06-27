"""Safe plugin registry for the node.

Each plugin exposes `run(args: dict) -> dict`. The returned dict is serialized as the
result `stdout`. Only plugins registered here can ever be executed; there is no path to
an arbitrary shell. See docs/seguridad.md.
"""

from __future__ import annotations

from typing import Any, Callable

from plugins import (
    allowed_command,
    echo,
    health_check,
    list_lab_directory,
    network_info,
    system_info,
)


class PluginError(Exception):
    """Raised by a plugin to signal a controlled failure."""


PluginFn = Callable[[dict[str, Any]], dict[str, Any]]

REGISTRY: dict[str, PluginFn] = {
    "system_info": system_info.run,
    "health_check": health_check.run,
    "echo": echo.run,
    "list_lab_directory": list_lab_directory.run,
    "network_info": network_info.run,
    "allowed_command": allowed_command.run,
}


def get_plugin(name: str) -> PluginFn | None:
    return REGISTRY.get(name)


def available_plugins() -> list[str]:
    return sorted(REGISTRY.keys())
