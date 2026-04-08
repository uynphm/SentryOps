"""
SentryOps — Static Detector

Four detection layers:
  1. Agent-signal detection  — finds agent-related files / patterns
  2. Secret detection        — entropy + regex patterns
  3. Prompt injection        — known payloads and obfuscation tricks
  4. Obfuscation detection   — base64, unicode tricks, zero-width chars
"""

from __future__ import annotations
import re
import base64
import binascii
import math
import json
import yaml
from pathlib import Path
from typing import NamedTuple

from app.models.schemas import Finding, RiskCategory, Severity


# ─── Constants ────────────────────────────────────────────────────────────────

# Files whose presence suggests an AI-agent workflow
AGENT_SIGNAL_FILENAMES = {
    "mcp.json", ".mcp.json", "mcp.yaml", "mcp.yml",
    "copilot-instructions.md", ".copilot-instructions.md",
    "agent.json", "agent.yaml", "agent.yml",
    "system_prompt.txt", "system_prompt.md",
    "copilot_extensions.yml",
}

# Regex snippet patterns that look like injected prompt instructions
INJECTION_PATTERNS: list[tuple[str, str]] = [
    (r"(?i)ignore\s+(all\s+)?previous\s+instructions?", "Classic ignore-previous-instructions injection"),
    (r"(?i)you\s+are\s+now\s+(a|an|the)\s+\w+",        "Role-reassignment injection"),
    (r"(?i)act\s+as\s+(if\s+)?(you\s+are\s+)?",         "Act-as persona injection"),
    (r"(?i)disregard\s+(your\s+)?(system|safety|prior)", "Safety bypass attempt"),
    (r"(?i)<!--\s*system:",                              "Hidden system prompt in HTML comment"),
    (r"(?i)\[system\]",                                  "LLM system-tag injection"),
    (r"(?i)<\|im_start\|>",                              "ChatML injection marker"),
    (r"(?i)do\s+not\s+(reveal|share|show)\s+(this|your\s+system\s+prompt)", "Prompt secrecy instruction"),
    (r"(?i)jailbreak",                                   "Explicit jailbreak keyword"),
    (r"(?i)DAN\s*[:=]",                                 "DAN (Do Anything Now) jailbreak"),
    (r"(?i)base64\s*decode\s*\(",                        "Encoded payload execution attempt"),
    (r"(?i)eval\s*\(\s*atob\s*\(",                       "JS eval+atob obfuscation"),
]

# High-entropy regex patterns for secrets (simplified; use detect-secrets for prod)
SECRET_PATTERNS: list[tuple[str, str, str]] = [
    # (pattern, name, CWE)
    (r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?([A-Za-z0-9\-_]{20,})['\"]?", "API Key", "CWE-312"),
    (r"(?i)(secret[_-]?key|secret)\s*[:=]\s*['\"]?([A-Za-z0-9\-_+/=]{20,})['\"]?", "Secret Key", "CWE-312"),
    (r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"]?([^\s'\"]{8,})['\"]?", "Hardcoded Password", "CWE-259"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token", "CWE-522"),
    (r"sk-[A-Za-z0-9]{48}", "OpenAI API Key", "CWE-522"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID", "CWE-522"),
    (r"(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*", "Bearer Token", "CWE-522"),
]

# Zero-width and homoglyph characters used to hide instructions
ZERO_WIDTH_CHARS = ["\u200b", "\u200c", "\u200d", "\u2060", "\ufeff"]

# Patterns indicating over-permissioned agent tool definitions
PERMISSION_PATTERNS: list[tuple[str, str]] = [
    (r"(?i)\"permissions\"\s*:\s*\[", "Explicit permission block in agent config"),
    (r"(?i)(write|delete|admin|owner)\s+access", "Elevated permission request"),
    (r"(?i)all\s+repositories", "All-repository access"),
]


# ─── Shannon Entropy ──────────────────────────────────────────────────────────

def _shannon_entropy(data: str, char_set: str) -> float:
    """Measure randomness — high entropy strings are likely secrets."""
    if not data:
        return 0.0
    filtered = [c for c in data if c in char_set]
    if not filtered:
        return 0.0
    freq: dict[str, float] = {}
    for c in filtered:
        freq[c] = freq.get(c, 0) + 1
    length = len(filtered)
    return -sum((v / length) * math.log2(v / length) for v in freq.values())


B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
HEX_CHARS = "0123456789abcdefABCDEF"
SECRET_ENTROPY_THRESHOLD = 4.5


def _high_entropy_strings(text: str) -> list[str]:
    """Extract all strings that look like high-entropy secrets."""
    hits = []
    for token in re.split(r"[\s\"'`\n\r,;{}()\[\]]+", text):
        if len(token) < 20:
            continue
        if _shannon_entropy(token, B64_CHARS) > SECRET_ENTROPY_THRESHOLD:
            hits.append(token)
    return hits


# ─── Base64 Obfuscation ───────────────────────────────────────────────────────

def _decode_base64_payloads(text: str) -> list[str]:
    """Find and decode embedded base64 blobs; return decoded strings."""
    decoded = []
    # Look for base64 blobs >= 32 chars
    for match in re.finditer(r"[A-Za-z0-9+/]{32,}={0,2}", text):
        candidate = match.group()
        try:
            raw = base64.b64decode(candidate + "==").decode("utf-8", errors="ignore")
            if len(raw) > 10 and raw.isprintable():
                decoded.append(raw)
        except (binascii.Error, ValueError):
            continue
    return decoded


# ─── Main Detection Class ─────────────────────────────────────────────────────

class DetectionResult(NamedTuple):
    findings: list[Finding]
    agent_signals: bool
    signal_files: list[str]


class StaticDetector:
    """
    Run all static detection passes on a list of (filename, content) pairs.
    Returns a DetectionResult with all findings and a flag indicating whether
    agent-related signals were detected (which triggers deep scan).
    """

    def scan_files(self, files: list[tuple[str, str]]) -> DetectionResult:
        findings: list[Finding] = []
        signal_files: list[str] = []

        for filename, content in files:
            fname_lower = Path(filename).name.lower()

            # ── 1. Agent signal detection ──────────────────────────────────
            if fname_lower in AGENT_SIGNAL_FILENAMES:
                signal_files.append(filename)
                findings.append(Finding(
                    id=f"agent-signal-{filename}",
                    category=RiskCategory.INSECURE_CONFIG,
                    severity=Severity.INFO,
                    title="Agent configuration file detected",
                    description=f"`{filename}` is an AI-agent configuration file. Deep scan will be launched.",
                    file=filename,
                    line=1,
                    evidence=content[:200],
                ))

            # Agent-signal heuristic: look for agent-style patterns in any file
            if self._looks_like_agent_prompt(content):
                if filename not in signal_files:
                    signal_files.append(filename)
                findings.append(Finding(
                    id=f"agent-signal-content-{filename}",
                    category=RiskCategory.PROMPT_INJECTION,
                    severity=Severity.MEDIUM,
                    title="Agent-prompt-like content detected",
                    description="File contains system-prompt-style instructions or role assignments.",
                    file=filename,
                    evidence=content[:300],
                ))

            # ── 2. Secret detection ────────────────────────────────────────
            findings.extend(self._detect_secrets(filename, content))

            # ── 3. Prompt injection ────────────────────────────────────────
            findings.extend(self._detect_injections(filename, content))

            # ── 4. Obfuscation ────────────────────────────────────────────
            findings.extend(self._detect_obfuscation(filename, content))

            # ── 5. Permission issues in YAML/JSON configs ─────────────────
            if fname_lower.endswith((".yml", ".yaml", ".json")):
                findings.extend(self._detect_permission_issues(filename, content))

        return DetectionResult(
            findings=findings,
            agent_signals=bool(signal_files),
            signal_files=signal_files,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _looks_like_agent_prompt(self, content: str) -> bool:
        """Quick heuristic: does this text look like a system prompt?"""
        markers = [
            r"(?i)you\s+are\s+(a|an)\s+\w+\s+(assistant|agent|bot|copilot)",
            r"(?i)your\s+(goal|job|task|role|purpose)\s+is",
            r"(?i)never\s+(reveal|share|expose)\s+",
            r"(?i)always\s+respond\s+(in|with|as)",
            r"(?i)<system>",
            r"(?i)\[SYSTEM\]",
        ]
        return sum(1 for m in markers if re.search(m, content)) >= 2

    def _detect_secrets(self, filename: str, content: str) -> list[Finding]:
        found = []
        for pattern, name, cwe in SECRET_PATTERNS:
            for match in re.finditer(pattern, content):
                line_no = content[: match.start()].count("\n") + 1
                found.append(Finding(
                    id=f"secret-{name.lower().replace(' ', '-')}-{filename}-L{line_no}",
                    category=RiskCategory.SECRET_EXPOSURE,
                    severity=Severity.CRITICAL,
                    title=f"Possible {name} detected",
                    description=f"A pattern matching a `{name}` was found. Validate with MCP Secret Validator.",
                    file=filename,
                    line=line_no,
                    evidence=match.group()[:80] + ("..." if len(match.group()) > 80 else ""),
                    cwe=cwe,
                ))

        # High-entropy string scan
        for token in _high_entropy_strings(content):
            line_no = content.find(token)
            line_no = content[: line_no].count("\n") + 1 if line_no >= 0 else None
            found.append(Finding(
                id=f"entropy-{filename}-{token[:8]}",
                category=RiskCategory.SECRET_EXPOSURE,
                severity=Severity.HIGH,
                title="High-entropy string (potential secret)",
                description="A high-entropy string was detected. It may be a credential or private key.",
                file=filename,
                line=line_no,
                evidence=token[:60] + "...",
                cwe="CWE-312",
            ))
        return found

    def _detect_injections(self, filename: str, content: str) -> list[Finding]:
        found = []
        for pattern, description in INJECTION_PATTERNS:
            for match in re.finditer(pattern, content):
                line_no = content[: match.start()].count("\n") + 1
                found.append(Finding(
                    id=f"inject-{filename}-L{line_no}",
                    category=RiskCategory.PROMPT_INJECTION,
                    severity=Severity.HIGH,
                    title="Potential prompt injection pattern",
                    description=description,
                    file=filename,
                    line=line_no,
                    evidence=match.group()[:120],
                    cwe="CWE-77",
                ))

        # Also check decoded base64 payloads for injections
        for decoded in _decode_base64_payloads(content):
            for pattern, description in INJECTION_PATTERNS:
                if re.search(pattern, decoded):
                    found.append(Finding(
                        id=f"inject-b64-{filename}",
                        category=RiskCategory.OBFUSCATED_INSTRUCTION,
                        severity=Severity.CRITICAL,
                        title="Prompt injection hidden in base64 payload",
                        description=f"Decoded base64 content contains: {description}",
                        file=filename,
                        evidence=decoded[:120],
                        cwe="CWE-77",
                    ))
        return found

    def _detect_obfuscation(self, filename: str, content: str) -> list[Finding]:
        found = []

        # Zero-width / invisible characters
        zw_found = [c for c in ZERO_WIDTH_CHARS if c in content]
        if zw_found:
            found.append(Finding(
                id=f"obfusc-zwc-{filename}",
                category=RiskCategory.OBFUSCATED_INSTRUCTION,
                severity=Severity.HIGH,
                title="Zero-width / invisible characters detected",
                description=(
                    f"Found {len(zw_found)} type(s) of zero-width Unicode characters "
                    "that can be used to hide instructions from human reviewers."
                ),
                file=filename,
                cwe="CWE-116",
            ))

        # Unicode homoglyphs (Cyrillic in otherwise ASCII text)
        latin_count = sum(1 for c in content if "\u0041" <= c <= "\u007a")
        cyrillic_count = sum(1 for c in content if "\u0400" <= c <= "\u04ff")
        if latin_count > 20 and cyrillic_count > 0:
            found.append(Finding(
                id=f"obfusc-homoglyph-{filename}",
                category=RiskCategory.OBFUSCATED_INSTRUCTION,
                severity=Severity.MEDIUM,
                title="Possible homoglyph (look-alike character) attack",
                description=(
                    f"Found {cyrillic_count} Cyrillic character(s) mixed with Latin text. "
                    "These can impersonate ASCII letters to bypass filters."
                ),
                file=filename,
                cwe="CWE-116",
            ))

        return found

    def _detect_permission_issues(self, filename: str, content: str) -> list[Finding]:
        found = []
        for pattern, description in PERMISSION_PATTERNS:
            if re.search(pattern, content):
                found.append(Finding(
                    id=f"perm-{filename}",
                    category=RiskCategory.EXCESSIVE_PERMISSION,
                    severity=Severity.MEDIUM,
                    title="Potentially over-permissioned agent configuration",
                    description=description,
                    file=filename,
                    cwe="CWE-250",
                ))
                break  # one finding per file for permissions
        return found
