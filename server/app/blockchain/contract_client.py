"""web3.py client for the ExecutionLedger contract.

Designed to degrade gracefully: if the ledger is disabled, the node is unreachable, or
no contract address is configured, the rest of the system keeps working and events are
simply marked as not-yet-anchored. The local hash chain in the DB is always maintained.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.core.hashing import to_bytes32

logger = logging.getLogger("aligo.blockchain")

_ABI_PATH = Path(__file__).parent / "contract_abi.json"

# Serialize on-chain txs so concurrent anchors never reuse the same nonce.
_tx_lock = threading.Lock()


class ContractClient:
    """Thin wrapper around the ExecutionLedger contract."""

    def __init__(self) -> None:
        self._web3: Any = None
        self._contract: Any = None
        self._account: Any = None
        self.available: bool = False
        self.reason: str = "not initialized"
        self._connect()

    def _connect(self) -> None:
        if not settings.ledger_enabled:
            self.reason = "ledger disabled (LEDGER_ENABLED=false)"
            logger.info("Blockchain ledger disabled via configuration.")
            return
        if not settings.contract_address:
            self.reason = "CONTRACT_ADDRESS not set"
            logger.warning("CONTRACT_ADDRESS is empty; on-chain anchoring disabled.")
            return

        try:
            from web3 import Web3
            from web3.middleware import ExtraDataToPOAMiddleware  # type: ignore

            web3 = Web3(Web3.HTTPProvider(settings.blockchain_rpc_url, request_kwargs={"timeout": 10}))
            try:
                web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            except Exception:  # pragma: no cover - middleware is optional
                pass

            if not web3.is_connected():
                self.reason = f"cannot reach RPC at {settings.blockchain_rpc_url}"
                logger.warning(self.reason)
                return

            abi = json.loads(_ABI_PATH.read_text(encoding="utf-8"))
            address = Web3.to_checksum_address(settings.contract_address)
            self._contract = web3.eth.contract(address=address, abi=abi)
            self._account = web3.eth.account.from_key(settings.blockchain_private_key)
            self._web3 = web3
            self.available = True
            self.reason = "connected"
            logger.info("Connected to ExecutionLedger at %s", address)
        except Exception as exc:  # pragma: no cover - network/runtime dependent
            self.reason = f"initialization error: {exc}"
            logger.warning("Blockchain client unavailable: %s", exc)

    def register_event(
        self,
        *,
        event_id: str,
        mission_id: str,
        task_id: str,
        node_id: str,
        event_type: str,
        payload_hash: str,
        previous_hash: str,
        timestamp_unix: int,
    ) -> dict[str, Any] | None:
        """Anchor an event on-chain. Returns {tx_hash, block_number} or None on failure."""
        if not self.available:
            return None
        with _tx_lock:
            try:
                web3 = self._web3
                fn = self._contract.functions.registerEvent(
                    event_id,
                    mission_id,
                    task_id,
                    node_id,
                    event_type,
                    to_bytes32(payload_hash),
                    to_bytes32(previous_hash),
                    int(timestamp_unix),
                )
                # 'pending' includes txs already submitted but not yet mined.
                nonce = web3.eth.get_transaction_count(
                    self._account.address, "pending"
                )
                tx = fn.build_transaction(
                    {
                        "from": self._account.address,
                        "nonce": nonce,
                        "gas": 1_500_000,
                        "gasPrice": web3.eth.gas_price,
                        "chainId": web3.eth.chain_id,
                    }
                )
                signed = self._account.sign_transaction(tx)
                tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
                return {
                    "tx_hash": tx_hash.hex(),
                    "block_number": int(receipt["blockNumber"]),
                }
            except Exception as exc:  # pragma: no cover - network/runtime dependent
                logger.warning("Failed to anchor event %s on-chain: %s", event_id, exc)
                return None

    def get_onchain_hash(self, event_id: str) -> str | None:
        """Return the on-chain payload hash (hex) for an event, or None."""
        if not self.available:
            return None
        try:
            if not self._contract.functions.eventExists(event_id).call():
                return None
            result = self._contract.functions.getEvent(event_id).call()
            payload_hash: bytes = result[4]  # 5th return value is payloadHash
            return "0x" + payload_hash.hex() if not payload_hash.hex().startswith("0x") else payload_hash.hex()
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to read on-chain event %s: %s", event_id, exc)
            return None

    def verify_event_hash(self, event_id: str, payload_hash: str) -> bool | None:
        """Ask the contract whether the supplied hash matches. None if unavailable."""
        if not self.available:
            return None
        try:
            return bool(
                self._contract.functions.verifyEventHash(
                    event_id, to_bytes32(payload_hash)
                ).call()
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("On-chain verify failed for %s: %s", event_id, exc)
            return None


_client: ContractClient | None = None


def get_contract_client() -> ContractClient:
    """Return a process-wide singleton contract client."""
    global _client
    if _client is None:
        _client = ContractClient()
    return _client
