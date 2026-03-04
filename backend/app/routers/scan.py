"""
SentryOps — /api/v1/scan routes.

POST /api/v1/scan/quick  → fast static pass (seconds)
POST /api/v1/scan/deep   → full multi-agent red-team (seconds–minutes)
POST /api/v1/scan/upload → multipart file upload convenience endpoint
"""

from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Security, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import get_settings, Settings
from app.core.detector import StaticDetector
from app.core.scoring import compute_score
from app.core.azure_clients import AuditLogger
from app.agents.orchestrator import get_graph
from app.models.schemas import (
    DeepScanRequest, DeepScanResult, FileInput,
    QuickScanRequest, QuickScanResult, ScanMode,
)
import structlog

log = structlog.get_logger(__name__)
router = APIRouter()
bearer = HTTPBearer(auto_error=False)


# ─── Auth dependency ──────────────────────────────────────────────────────────

def verify_api_key(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)],
    settings: Settings = Depends(get_settings),
) -> None:
    if settings.debug:
        return  # Skip auth in local dev
    if not credentials or credentials.credentials != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ─── POST /scan/quick ─────────────────────────────────────────────────────────

@router.post(
    "/scan/quick",
    response_model=QuickScanResult,
    summary="Fast static scan — runs in <5s",
    dependencies=[Depends(verify_api_key)],
)
async def quick_scan(body: QuickScanRequest) -> QuickScanResult:
    """
    Runs the 5-pass static detector:
      1. Agent-signal detection
      2. Secret scanning (entropy + regex)
      3. Prompt injection detection
      4. Obfuscation detection (zero-width, homoglyphs, base64)
      5. Permission over-grant detection

    Returns a score and whether to proceed to deep scan.
    """
    scan_id = str(uuid.uuid4())
    log.info("quick_scan_start", scan_id=scan_id, files=len(body.files))

    detector = StaticDetector()
    files_tuples = [(f.filename, f.content) for f in body.files]
    det_result = detector.scan_files(files_tuples)
    score = compute_score(det_result.findings)

    critical_count = sum(1 for f in det_result.findings if f.severity.value == "CRITICAL")
    high_count = sum(1 for f in det_result.findings if f.severity.value == "HIGH")

    summary_parts = [f"**Score: {score.total}/100 (Grade {score.grade})**"]
    if det_result.agent_signals:
        summary_parts.append("⚡ Agent-related files detected — deep scan recommended.")
    if critical_count:
        summary_parts.append(f"🚨 {critical_count} CRITICAL issue(s) found.")
    if high_count:
        summary_parts.append(f"⚠️ {high_count} HIGH severity issue(s) found.")
    if not det_result.findings:
        summary_parts.append("✅ No issues detected in static scan.")

    result = QuickScanResult(
        scan_id=scan_id,
        mode=ScanMode.QUICK,
        score=score,
        findings=det_result.findings,
        agent_signals_detected=det_result.agent_signals,
        summary="\n".join(summary_parts),
    )
    log.info("quick_scan_complete", scan_id=scan_id, score=score.total,
             findings=len(det_result.findings))
    return result


# ─── POST /scan/deep ──────────────────────────────────────────────────────────

@router.post(
    "/scan/deep",
    response_model=DeepScanResult,
    summary="Full adversarial multi-agent red-team scan",
    dependencies=[Depends(verify_api_key)],
)
async def deep_scan(body: DeepScanRequest) -> DeepScanResult:
    """
    Launches the LangGraph multi-agent pipeline:
      1. Static scan (re-runs for fresh results)
      2. 3 parallel Shadow Agents (Claude 3.5 Sonnet):
         - PromptInjector, RolePlayEscaper, SecretExtractor
      3. Breach evaluation → marks findings as exploitable
      4. Remediation generation (Gemini) → GitHub suggestion blocks
      5. Final scoring with exploitability penalties

    Results are persisted to Azure Blob as an immutable audit log.
    """
    scan_id = str(uuid.uuid4())
    log.info("deep_scan_start", scan_id=scan_id, files=len(body.files))

    graph = get_graph()

    initial_state = {
        "scan_id": scan_id,
        "files": [{"filename": f.filename, "content": f.content} for f in body.files],
        "findings": [],
        "agent_signals": True,   # deep scan always runs shadow agents
        "signal_files": [],
        "shadow_agents": [],
        "chain_of_thought": [],
        "suggestions": [],
        "score": None,
        "quick_findings": [f.model_dump() for f in body.quick_findings],
        "mode": "deep",
    }

    final_state = await graph.ainvoke(initial_state)

    # Persist audit log to Azure Blob
    audit = AuditLogger()
    audit_url = await audit.persist(scan_id, {
        "scan_id": scan_id,
        "findings": [f.model_dump() for f in final_state["findings"]],
        "suggestions": [s.model_dump() for s in final_state["suggestions"]],
        "chain_of_thought": [s.model_dump() for s in final_state["chain_of_thought"]],
        "shadow_agents": [a.model_dump() for a in final_state["shadow_agents"]],
        "score": final_state["score"].model_dump() if final_state["score"] else None,
    })

    result = DeepScanResult(
        scan_id=scan_id,
        mode=ScanMode.DEEP,
        score=final_state["score"],
        findings=final_state["findings"],
        suggestions=final_state["suggestions"],
        shadow_agents=final_state["shadow_agents"],
        chain_of_thought=final_state["chain_of_thought"],
        audit_log_url=audit_url,
    )

    log.info("deep_scan_complete", scan_id=scan_id, score=result.score.total,
             breaches=sum(1 for a in result.shadow_agents if a.breach_detected))
    return result


# ─── POST /scan/upload ────────────────────────────────────────────────────────

@router.post(
    "/scan/upload",
    response_model=QuickScanResult,
    summary="Upload files directly for quick scan (multipart form)",
    dependencies=[Depends(verify_api_key)],
)
async def scan_uploaded_files(
    files: list[UploadFile] = File(...),
) -> QuickScanResult:
    """Convenience endpoint — accepts raw file uploads (YAML, JSON, MD, py, etc.)."""
    parsed: list[FileInput] = []
    for upload in files:
        content_bytes = await upload.read()
        try:
            content = content_bytes.decode("utf-8", errors="replace")
        except Exception:
            content = ""
        parsed.append(FileInput(filename=upload.filename or "unknown", content=content))

    return await quick_scan(QuickScanRequest(files=parsed))
