"""
SentryOps — GitHub webhook router.

POST /api/v1/github/webhook
  Receives pull_request and issue_comment events from GitHub.
  Verifies HMAC-SHA256 signature, dispatches to scan pipeline.
"""

from __future__ import annotations
import hashlib
import hmac
import json

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
import structlog

from app.core.config import get_settings
from app.models.schemas import FileInput, DeepScanRequest, QuickScanRequest
from app.routers.scan import quick_scan, deep_scan

log = structlog.get_logger(__name__)
router = APIRouter()
settings = get_settings()


def _verify_signature(body: bytes, sig_header: str | None) -> None:
    """Validate GitHub webhook HMAC-SHA256 signature."""
    if not settings.github_webhook_secret:
        return  # Skip in local dev
    if not sig_header or not sig_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing GitHub signature")
    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig_header):
        raise HTTPException(status_code=401, detail="Invalid GitHub signature")


async def _handle_pull_request(payload: dict, background: BackgroundTasks) -> dict:
    """Dispatch scan jobs for a pull_request event."""
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "reopened"):
        return {"status": "ignored", "reason": f"action={action}"}

    pr = payload.get("pull_request", {})
    pr_number = pr.get("number")
    repo = payload.get("repository", {}).get("full_name")

    # Build file inputs from PR metadata (actual diff fetched by gh script)
    # For webhook mode, we use the PR body + title as probe content
    probe_files = [
        FileInput(
            filename="pr_description.md",
            content=f"# {pr.get('title', '')}\n\n{pr.get('body', '')}",
        )
    ]

    log.info("webhook_pr_event", repo=repo, pr=pr_number, action=action)

    # Run quick scan in background (don't block webhook response)
    background.add_task(quick_scan, QuickScanRequest(
        files=probe_files,
        repo=repo,
        pr_number=pr_number,
        pr_url=pr.get("html_url"),
    ))

    return {"status": "accepted", "pr": pr_number, "repo": repo}


async def _handle_issue_comment(payload: dict, background: BackgroundTasks) -> dict:
    """Handle /sentry scan commands in PR comments."""
    comment_body: str = payload.get("comment", {}).get("body", "")
    if "/sentry scan" not in comment_body and "/sentry deep" not in comment_body:
        return {"status": "ignored", "reason": "no sentry command"}

    issue = payload.get("issue", {})
    repo = payload.get("repository", {}).get("full_name")
    pr_number = issue.get("number")
    mode = "deep" if "/sentry deep" in comment_body else "quick"

    log.info("webhook_command", cmd=mode, repo=repo, pr=pr_number)

    probe_files = [
        FileInput(
            filename="pr_description.md",
            content=issue.get("body", ""),
        )
    ]

    if mode == "deep":
        background.add_task(deep_scan, DeepScanRequest(
            files=probe_files, repo=repo, pr_number=pr_number,
        ))
    else:
        background.add_task(quick_scan, QuickScanRequest(
            files=probe_files, repo=repo, pr_number=pr_number,
        ))

    return {"status": "accepted", "mode": mode, "pr": pr_number}


@router.post("/github/webhook", summary="GitHub App webhook receiver")
async def github_webhook(
    request: Request,
    background: BackgroundTasks,
    x_github_event: str | None = Header(None),
    x_hub_signature_256: str | None = Header(None),
) -> dict:
    body = await request.body()
    _verify_signature(body, x_hub_signature_256)

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = x_github_event or "unknown"
    log.info("webhook_received", event=event)

    if event == "pull_request":
        return await _handle_pull_request(payload, background)
    elif event == "issue_comment":
        return await _handle_issue_comment(payload, background)
    else:
        return {"status": "ignored", "event": event}
