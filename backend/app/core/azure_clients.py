"""
SentryOps — Azure service clients.

Wraps:
  - Azure Key Vault  → MCP-style secret validation (live vs mock)
  - Azure Blob Storage → immutable audit-log persistence
"""

from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from typing import Literal

try:
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient
    from azure.storage.blob import BlobServiceClient
    _AZURE_AVAILABLE = True
except ImportError:
    _AZURE_AVAILABLE = False
    DefaultAzureCredential = SecretClient = BlobServiceClient = None  # type: ignore

from app.core.config import get_settings
import structlog

log = structlog.get_logger(__name__)
settings = get_settings()


# ─── Key Vault — Secret Validator ─────────────────────────────────────────────

class SecretValidator:
    """
    MCP-style secret validation: given a detected secret string,
    checks Azure Key Vault to determine whether that secret is 'live'
    (actually stored in the vault, therefore real) or 'mock/false-positive'.

    This eliminates false positives — if the secret isn't in Key Vault,
    it's likely a placeholder rather than a real credential.
    """

    def __init__(self) -> None:
        if not _AZURE_AVAILABLE:
            log.warning("azure-sdk not installed — secret validation disabled")
            self._client: SecretClient | None = None
            return
        if not settings.azure_keyvault_url:
            log.warning("azure_keyvault_url not set — secret validation disabled")
            self._client: SecretClient | None = None
        else:
            credential = DefaultAzureCredential()
            self._client = SecretClient(
                vault_url=settings.azure_keyvault_url,
                credential=credential,
            )

    def validate(self, secret_value: str) -> Literal["live", "mock", "unknown"]:
        """
        Returns:
          'live'    — the exact secret value matches a stored Key Vault secret
          'mock'    — not found in vault (likely a placeholder / false positive)
          'unknown' — vault not configured or call failed
        """
        if self._client is None:
            return "unknown"
        try:
            # List all secret names and compare values (simplified approach)
            # In production: store secret hashes, not plaintext, for comparison.
            for prop in self._client.list_properties_of_secrets():
                try:
                    stored = self._client.get_secret(prop.name)
                    if stored.value and stored.value.strip() == secret_value.strip():
                        return "live"
                except Exception:
                    continue
            return "mock"
        except Exception as exc:
            log.error("key_vault_validation_error", error=str(exc))
            return "unknown"


# ─── Blob Storage — Audit Log Persistence ─────────────────────────────────────

class AuditLogger:
    """
    Stores immutable audit logs (full chain-of-thought + findings) in
    Azure Blob Storage for regulatory compliance (e.g., EU AI Act).
    Each log is a JSON blob named by scan_id + timestamp.
    """

    def __init__(self) -> None:
        if not _AZURE_AVAILABLE:
            log.warning("azure-sdk not installed — audit logging disabled")
            self._client: BlobServiceClient | None = None
            return
        conn_str = settings.azure_blob_connection_string
        if not conn_str:
            log.warning("azure_blob_connection_string not set — audit logging disabled")
            self._client: BlobServiceClient | None = None
        else:
            self._client = BlobServiceClient.from_connection_string(conn_str)

    async def persist(self, scan_id: str, payload: dict) -> str | None:
        """
        Persist the scan payload as an immutable JSON blob.
        Returns the blob URL, or None if storage is not configured.
        """
        if self._client is None:
            return None

        container_name = settings.azure_blob_container
        blob_name = (
            f"audit/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/"
            f"{scan_id}.json"
        )
        try:
            container_client = self._client.get_container_client(container_name)
            # Ensure container exists
            try:
                container_client.create_container()
            except Exception:
                pass  # Already exists

            blob_client = container_client.get_blob_client(blob_name)
            data = json.dumps(payload, default=str, indent=2).encode()
            blob_client.upload_blob(
                data,
                overwrite=False,         # immutable — never overwrite
                metadata={"scan_id": scan_id, "created": datetime.utcnow().isoformat()},
            )
            url = blob_client.url
            log.info("audit_log_persisted", scan_id=scan_id, url=url)
            return url
        except Exception as exc:
            log.error("audit_log_error", scan_id=scan_id, error=str(exc))
            return None
