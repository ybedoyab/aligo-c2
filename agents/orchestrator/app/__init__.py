"""Aligo Agent — Claude-based AI orchestration layer for the C2 MVP.

A separate process and a pure client of the C2 server. It talks only over the
public REST + /ws/operator surface; it never touches nodes, the DB, or server
internals. See agent-plan.md and agents/orchestrator/README.md.
"""

__version__ = "0.1.0"
