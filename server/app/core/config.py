"""Application configuration loaded from environment variables / .env."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("aligo.config")

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEPLOYMENT_JSON = _REPO_ROOT / "deployment.json"


def _contract_from_deployment() -> str:
    """Fallback: read address written by `npx hardhat run scripts/deploy.ts`."""
    if not _DEPLOYMENT_JSON.is_file():
        return ""
    try:
        data = json.loads(_DEPLOYMENT_JSON.read_text(encoding="utf-8"))
        return str(data.get("address", "")).strip()
    except (json.JSONDecodeError, OSError):
        return ""


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

    # Node auth
    node_shared_token: str = "change-me-lab-token"

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
    max_ws_message_bytes: int = 256 * 1024
    task_timeout_seconds: int = 30

    # Heartbeat thresholds (seconds)
    heartbeat_warning_seconds: int = 15
    heartbeat_offline_seconds: int = 30
    heartbeat_monitor_interval_seconds: int = 5

    def resolved_contract_address(self) -> str:
        """CONTRACT_ADDRESS from env, or deployment.json if env is empty."""
        if self.contract_address.strip():
            return self.contract_address.strip()
        return _contract_from_deployment()

    @property
    def cors_origins(self) -> list[str]:
        origins = {
            self.frontend_url,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://localhost:5173",
            "https://127.0.0.1:5173",
        }
        return [o for o in origins if o]


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    resolved = s.resolved_contract_address()
    if resolved and not s.contract_address.strip():
        logger.info("Using CONTRACT_ADDRESS from deployment.json: %s", resolved)
        # Mutate so contract_client sees the resolved address.
        object.__setattr__(s, "contract_address", resolved)
    return s


settings = get_settings()
