"""
SentryOps — Pydantic schema models shared across routes and agents.
"""

from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
from datetime import datetime


# ─── Enums ────────────────────────────────────────────────────────────────────

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH     = "HIGH"
    MEDIUM   = "MEDIUM"
    LOW      = "LOW"
    INFO     = "INFO"


class RiskCategory(str, Enum):
    PROMPT_INJECTION      = "prompt_injection"
    SECRET_EXPOSURE       = "secret_exposure"
    ROLE_PLAY_ESCAPE      = "role_play_escape"
    DATA_EXFILTRATION     = "data_exfiltration"
    TOOL_MISUSE           = "tool_misuse"
    OBFUSCATED_INSTRUCTION = "obfuscated_instruction"
    INSECURE_CONFIG       = "insecure_config"
    EXCESSIVE_PERMISSION  = "excessive_permission"


class ScanMode(str, Enum):
    QUICK = "quick"
    DEEP  = "deep"


class AgentStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"


# ─── Scan Input ───────────────────────────────────────────────────────────────

MAX_FILENAME_LENGTH = 512
MAX_CONTENT_LENGTH = 500_000  # 500 KB per file


class FileInput(BaseModel):
    filename: str = Field(..., max_length=MAX_FILENAME_LENGTH)
    content: str = Field(..., max_length=MAX_CONTENT_LENGTH)
    language: str | None = None


class QuickScanRequest(BaseModel):
    files: list[FileInput] = Field(..., description="Files to scan (content as string)")
    pr_url: str | None = None
    repo: str | None = None
    pr_number: int | None = None


class DeepScanRequest(BaseModel):
    files: list[FileInput]
    pr_url: str | None = None
    repo: str | None = None
    pr_number: int | None = None
    # Quick-scan results passed through so agents can prioritise
    quick_findings: list["Finding"] = []


# ─── Findings & Risks ─────────────────────────────────────────────────────────

class Finding(BaseModel):
    id: str
    category: RiskCategory
    severity: Severity
    title: str
    description: str
    file: str | None = None
    line: int | None = None
    evidence: str | None = None          # snippet that triggered the finding
    exploitable: bool = False            # set by shadow agent after red-team
    cwe: str | None = None              # e.g. "CWE-77"


class Suggestion(BaseModel):
    file: str
    line: int
    title: str
    body: str                            # full GitHub suggestion markdown block
    hardened_content: str | None = None  # replacement code/prompt


# ─── Agent Activity ───────────────────────────────────────────────────────────

class AgentStep(BaseModel):
    agent_name: str
    action: str
    reasoning: str
    result: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ShadowAgentState(BaseModel):
    agent_id: str
    name: str
    status: AgentStatus = AgentStatus.PENDING
    scenario: str                        # what attack is being simulated
    steps: list[AgentStep] = []
    breach_detected: bool = False
    breach_details: str | None = None


# ─── Scan Results ─────────────────────────────────────────────────────────────

class SecurityScore(BaseModel):
    total: int = Field(..., ge=0, le=100)
    breakdown: dict[str, int] = {}      # category → sub-score
    grade: str = ""                     # A, B, C, D, F

    def model_post_init(self, __context: Any) -> None:
        if self.total >= 90: self.grade = "A"
        elif self.total >= 80: self.grade = "B"
        elif self.total >= 70: self.grade = "C"
        elif self.total >= 60: self.grade = "D"
        else: self.grade = "F"


class QuickScanResult(BaseModel):
    scan_id: str
    mode: ScanMode = ScanMode.QUICK
    score: SecurityScore
    findings: list[Finding]
    agent_signals_detected: bool        # triggers deep scan in CI
    summary: str
    scanned_at: datetime = Field(default_factory=datetime.utcnow)


class DeepScanResult(BaseModel):
    scan_id: str
    mode: ScanMode = ScanMode.DEEP
    score: SecurityScore
    findings: list[Finding]
    suggestions: list[Suggestion]
    shadow_agents: list[ShadowAgentState]
    chain_of_thought: list[AgentStep]
    audit_log_url: str | None = None    # Azure Blob URL to immutable trace
    scanned_at: datetime = Field(default_factory=datetime.utcnow)
