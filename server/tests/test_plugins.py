"""Tests for the agent's safe plugins (imported from the agent package)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make the agent package importable (agent/ is a sibling of server/).
_AGENT_DIR = Path(__file__).resolve().parents[2] / "agent"
if str(_AGENT_DIR) not in sys.path:
    sys.path.insert(0, str(_AGENT_DIR))

from plugins import allowed_command, list_lab_directory, system_info  # noqa: E402


def test_system_info_returns_expected_keys():
    info = system_info.run({})
    for key in ("os", "hostname", "username", "python_version", "cpu_count"):
        assert key in info
    assert isinstance(info["python_version"], str)


def test_list_lab_directory_lists_sandbox_root():
    result = list_lab_directory.run({"path": "."})
    assert "entries" in result
    names = {e["name"] for e in result["entries"]}
    assert "README.md" in names


def test_list_lab_directory_blocks_path_traversal():
    with pytest.raises(ValueError):
        list_lab_directory.run({"path": "../../"})
    with pytest.raises(ValueError):
        list_lab_directory.run({"path": "../secrets"})


def test_allowed_command_accepts_allowlisted():
    result = allowed_command.run({"command": "whoami"})
    assert result["command"] == "whoami"
    assert isinstance(result["output"], str) and result["output"]


def test_allowed_command_rejects_unlisted():
    for bad in ("rm", "ls", "cat /etc/passwd", "curl"):
        with pytest.raises(ValueError):
            allowed_command.run({"command": bad})
