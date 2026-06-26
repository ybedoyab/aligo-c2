"""Application configuration loaded from environment variables / .env."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object. Values come from environment or a .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    # Database
    database_url: str = "sqlite:///./c2.db"

    # Agent auth
    agent_shared_token: str = "change-me-lab-token"

    # Ledger / blockchain
    ledger_enabled: bool = True
    blockchain_rpc_url: str = "http://localhost:8545"
    contract_address: str = ""
    blockchain_private_key: str = (
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    )

    # Frontend / CORS
    frontend_url: str = "http://localhost:5173"

    # WebSocket / task safety limits
    max_ws_message_bytes: int = 256 * 1024  # 256 KiB cap on inbound WS messages
    task_timeout_seconds: int = 30

    # Heartbeat thresholds (seconds)
    heartbeat_warning_seconds: int = 15
    heartbeat_offline_seconds: int = 30
    heartbeat_monitor_interval_seconds: int = 5

    @property
    def cors_origins(self) -> list[str]:
        """Origins allowed by CORS (frontend dev + common localhost variants)."""
        origins = {self.frontend_url, "http://localhost:5173", "http://127.0.0.1:5173"}
        return [o for o in origins if o]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


settings = get_settings()
