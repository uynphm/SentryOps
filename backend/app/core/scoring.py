"""
SentryOps — Security Confidence Score Calculator

Scoring model (0–100):
  Starts at 100. Deductions per finding based on severity.
  Bonuses for clean categories.
"""

from __future__ import annotations
from app.models.schemas import Finding, SecurityScore, Severity, RiskCategory


# Severity → point deduction per finding
SEVERITY_DEDUCTIONS: dict[Severity, int] = {
    Severity.CRITICAL: 25,
    Severity.HIGH:     12,
    Severity.MEDIUM:    6,
    Severity.LOW:       2,
    Severity.INFO:      0,
}

# If shadow-agent confirmed exploitability — additional penalty
EXPLOITABLE_PENALTY = 15

# Category weights for breakdown sub-scores
CATEGORY_WEIGHTS: dict[RiskCategory, str] = {
    RiskCategory.PROMPT_INJECTION:       "Prompt Safety",
    RiskCategory.SECRET_EXPOSURE:        "Secret Hygiene",
    RiskCategory.ROLE_PLAY_ESCAPE:       "Prompt Safety",
    RiskCategory.DATA_EXFILTRATION:      "Tool Safety",
    RiskCategory.TOOL_MISUSE:            "Tool Safety",
    RiskCategory.OBFUSCATED_INSTRUCTION: "Obfuscation",
    RiskCategory.INSECURE_CONFIG:        "Config Hygiene",
    RiskCategory.EXCESSIVE_PERMISSION:   "Config Hygiene",
}

CATEGORY_NAMES = list({v for v in CATEGORY_WEIGHTS.values()})


def compute_score(findings: list[Finding]) -> SecurityScore:
    """Compute the overall security confidence score from a list of findings."""
    score = 100

    # Per-category sub-score tracking
    category_deductions: dict[str, int] = {name: 0 for name in CATEGORY_NAMES}

    for f in findings:
        deduction = SEVERITY_DEDUCTIONS.get(f.severity, 0)
        if f.exploitable:
            deduction += EXPLOITABLE_PENALTY
        score -= deduction

        cat_name = CATEGORY_WEIGHTS.get(f.category, "Other")
        category_deductions[cat_name] = category_deductions.get(cat_name, 0) + deduction

    # Clamp total
    total = max(0, min(100, score))

    # Derive per-category sub-scores (100 − deductions, clamped)
    breakdown = {
        cat: max(0, min(100, 100 - ded))
        for cat, ded in category_deductions.items()
        if ded > 0
    }

    return SecurityScore(total=total, breakdown=breakdown)
