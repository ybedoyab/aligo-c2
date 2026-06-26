"""echo plugin: return the supplied text unchanged."""

from __future__ import annotations

from typing import Any


def run(args: dict[str, Any]) -> dict[str, Any]:
    text = args.get("text", "")
    if not isinstance(text, str):
        text = str(text)
    return {"echo": text, "length": len(text)}
