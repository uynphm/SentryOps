"""
SentryOps — Audit log router.

GET /api/v1/audit/{scan_id}  → retrieve audit trail metadata
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import structlog

log = structlog.get_logger(__name__)
router = APIRouter()

# In-memory store for demo; replace with DB / Blob index in production
_audit_store: dict[str, dict] = {}


class AuditEntry(BaseModel):
    scan_id: str
    blob_url: str | None = None
    summary: str = ""


@router.get("/audit/{scan_id}", response_model=AuditEntry, summary="Get audit trail for a scan")
async def get_audit(scan_id: str) -> AuditEntry:
    entry = _audit_store.get(scan_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Audit entry not found")
    return AuditEntry(**entry)


def register_audit(scan_id: str, blob_url: str | None, summary: str) -> None:
    """Called by the scan pipeline after persisting to Azure Blob."""
    _audit_store[scan_id] = {
        "scan_id": scan_id,
        "blob_url": blob_url,
        "summary": summary,
    }
