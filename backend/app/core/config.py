"""
SentryOps — core application settings.
All secrets are loaded from environment variables (never hard-coded).
In production, inject these via Azure Container Apps secrets or a .env file.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ───────────────────────────────────────────────────────────────────
    app_name: str = "SentryOps"
    app_version: str = "0.1.0"
    debug: bool = False
    api_key: str = "change-me-in-production"   # Bearer token for dashboard UI
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── AI models ────────────────────────────────────────────────────────────
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    @field_validator("anthropic_api_key")
    @classmethod
    def anthropic_key_required(cls, v: str, info: object) -> str:
        # Allow empty in debug mode; enforced at runtime by orchestrator
        if not v:
            import os
            if not os.getenv("DEBUG", "false").lower() in ("1", "true"):
                raise ValueError(
                    "ANTHROPIC_API_KEY is required in non-debug mode. "
                    "Set it in your .env file or environment."
                )
        return v

    @field_validator("gemini_api_key")
    @classmethod
    def gemini_key_required(cls, v: str, info: object) -> str:
        if not v:
            import os
            if not os.getenv("DEBUG", "false").lower() in ("1", "true"):
                raise ValueError(
                    "GEMINI_API_KEY is required in non-debug mode. "
                    "Set it in your .env file or environment."
                )
        return v
    claude_model: str = "claude-3-5-sonnet-20241022"
    gemini_model: str = "gemini-1.5-pro"

    # ── GitHub ───────────────────────────────────────────────────────────────
    github_app_id: str = ""
    github_app_private_key: str = ""   # PEM contents, newlines as \\n
    github_webhook_secret: str = ""
    github_token: str = ""             # PAT fallback for local dev

    # ── Azure ─────────────────────────────────────────────────────────────────
    azure_keyvault_url: str = ""        # https://<vault>.vault.azure.net
    azure_blob_connection_string: str = ""
    azure_blob_container: str = "sentryops-audit-logs"

    # ── Scoring thresholds ───────────────────────────────────────────────────
    score_pass_threshold: int = 60      # ≥60 → pass, <60 → fail check run
    score_warn_threshold: int = 80      # <80 → warning annotation


@lru_cache
def get_settings() -> Settings:
    return Settings()
