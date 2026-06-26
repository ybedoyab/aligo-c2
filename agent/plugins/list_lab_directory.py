"""list_lab_directory plugin: list files ONLY inside agent/lab_workspace.

Path traversal is strictly prevented: the resolved target must stay within the sandbox.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

# agent/plugins/list_lab_directory.py -> agent/lab_workspace
_SANDBOX_ROOT = (Path(__file__).resolve().parent.parent / "lab_workspace").resolve()


def run(args: dict[str, Any]) -> dict[str, Any]:
    requested = str(args.get("path", ".") or ".")

    # Reject absolute paths outright; only relative subpaths are allowed.
    candidate = (_SANDBOX_ROOT / requested).resolve()

    # Ensure the resolved path is the sandbox root or a descendant of it.
    if candidate != _SANDBOX_ROOT and _SANDBOX_ROOT not in candidate.parents:
        raise ValueError("path escapes the lab workspace sandbox")

    if not candidate.exists():
        raise ValueError("path does not exist inside the lab workspace")
    if not candidate.is_dir():
        raise ValueError("path is not a directory")

    entries: list[dict[str, Any]] = []
    for child in sorted(candidate.iterdir(), key=lambda p: p.name):
        entries.append(
            {
                "name": child.name,
                "is_dir": child.is_dir(),
                "size_bytes": child.stat().st_size if child.is_file() else None,
            }
        )

    return {
        "sandbox_root": str(_SANDBOX_ROOT),
        "listed_path": str(candidate.relative_to(_SANDBOX_ROOT)) or ".",
        "entry_count": len(entries),
        "entries": entries,
    }
