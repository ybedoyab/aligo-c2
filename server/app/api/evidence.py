"""Independent evidence verification API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import verifier_service

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


class VerifyBundleRequest(BaseModel):
    bundle: dict[str, Any] = Field(description="Self-contained evidence JSON bundle")


@router.post("/verify")
def verify_bundle(body: VerifyBundleRequest) -> dict[str, Any]:
    """Verify an evidence bundle without trusting dashboard state."""
    return verifier_service.verify_evidence_bundle(body.bundle)
