"""Agent configuration — isolated from the C2 server settings.

All values come from environment / `agents/orchestrator/.env`. The agent NEVER reads or mutates
the server's settings; this keeps the contract one-directional (agent -> C2 REST).
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Anthropic / LLM -----------------------------------------------------
    # Read with the conventional unprefixed name so langchain-anthropic and this
    # app agree. Leave empty to wire later; the read-only smoke test does not
    # need it, but the chat graph does.
    anthropic_api_key: str = ""
    agent_model: str = "claude-opus-4-8"
    agent_max_tokens: int = 8000

    # --- C2 contract (the only external surface the agent consumes) ----------
    c2_base_url: str = "http://localhost:8000"
    c2_ws_url: str = "ws://localhost:8000/ws/operator"
    c2_request_timeout: float = 30.0

    # --- Agent backend bind --------------------------------------------------
    agent_host: str = "0.0.0.0"
    agent_port: int = 8100

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
