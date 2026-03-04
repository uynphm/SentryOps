# 🛡 SentryOps

**Autonomous Security Governance & Remediation for GitHub Copilot Extensions**

SentryOps is a dual-mode AI security tool that detects and fixes the "Lethal Trifecta" of AI-agent risks: prompt injection, secret exposure, and unvalidated tool access.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DUAL-MODE ENTRY POINTS                       │
├─────────────────────────┬───────────────────────────────────────────┤
│  Mode 1: GitHub-Native  │  Mode 2: Security Dashboard               │
│                         │                                           │
│  pull_request event     │  React UI (Vite + port 5173)              │
│  issue_comment event    │  Upload files / paste prompts             │
│  /sentry scan command   │  Visual score + tabbed results            │
└────────────┬────────────┴────────────────────┬────────────────────-─┘
             │                                 │
             ▼                                 ▼
    ┌─────────────────────────────────────────────────────┐
    │              FastAPI Backend  (port 8000)            │
    │                                                     │
    │  POST /api/v1/scan/quick   ← 5-pass static scan     │
    │  POST /api/v1/scan/deep    ← full red-team pipeline │
    │  POST /api/v1/scan/upload  ← multipart file upload  │
    │  POST /api/v1/github/webhook                        │
    │  GET  /api/v1/audit/{id}                            │
    └──────────────────────┬──────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────────────────┐
    │              LangGraph Orchestration                  │
    │                                                      │
    │  [static_scan] → conditional edge                    │
    │      │                                               │
    │      ├── (agent signals) → [shadow_agents]           │
    │      │       │   Claude 3.5 Sonnet × 3 agents        │
    │      │       │   • PromptInjector                    │
    │      │       │   • RolePlayEscaper                   │
    │      │       │   • SecretExtractor                   │
    │      │       ▼                                       │
    │      │  [evaluate_breaches]                          │
    │      │       ▼                                       │
    │      │  [generate_remediations] — Gemini 1.5 Pro     │
    │      │       ▼                                       │
    │      └──────→ [compute_score] → END                  │
    └──────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴──────────────────┐
           ▼                                  ▼
   Azure Key Vault                   Azure Blob Storage
   (MCP Secret Validator)            (Immutable Audit Logs)
```

---

## Project Structure

```
sentryops/
├── .github/
│   └── workflows/
│       └── sentry-ops.yml        ← GitHub Action (PR + comment triggers)
│
├── backend/
│   ├── app/
│   │   ├── main.py               ← FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py         ← Pydantic settings (env vars)
│   │   │   ├── detector.py       ← 5-pass static scanner
│   │   │   ├── scoring.py        ← Security confidence score
│   │   │   └── azure_clients.py  ← Key Vault + Blob Storage
│   │   ├── agents/
│   │   │   └── orchestrator.py   ← LangGraph multi-agent graph
│   │   ├── models/
│   │   │   └── schemas.py        ← Pydantic request/response models
│   │   └── routers/
│   │       ├── scan.py           ← /scan/quick, /scan/deep, /scan/upload
│   │       ├── github.py         ← Webhook receiver
│   │       └── audit.py          ← Audit trail retrieval
│   ├── scripts/
│   │   ├── gh_quick_scan.py      ← GitHub Action helper (static)
│   │   └── gh_deep_scan.py       ← GitHub Action helper (deep)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
└── dashboard/
    ├── src/
    │   ├── App.jsx               ← Root layout + router
    │   ├── index.css             ← Full design system (dark mode)
    │   ├── api/client.js         ← Axios API wrapper
    │   ├── components/
    │   │   ├── ScoreGauge.jsx    ← Animated SVG circular gauge
    │   │   ├── RiskTable.jsx     ← Expandable findings table
    │   │   ├── ShadowAgentPanel  ← Agent status + breach details
    │   │   ├── AuditTrail.jsx    ← Chain-of-thought timeline
    │   │   ├── UploadPanel.jsx   ← Drag & drop + paste mode
    │   │   └── RemediationPanel  ← Hardened fix viewer
    │   └── pages/
    │       ├── Dashboard.jsx     ← Stats, recent scans, how it works
    │       └── ScanPage.jsx      ← Full scan workflow UI
    └── vite.config.js            ← Proxy to FastAPI backend
```

---

## Quick Start — Local Development

### 1. Backend

```bash
cd backend

# Create virtual environment
python3 -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — add your API keys (minimum: ANTHROPIC_API_KEY, GEMINI_API_KEY)
# Set DEBUG=true to skip bearer-token auth locally

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Dashboard

```bash
cd dashboard

# Install Node dependencies (already done by scaffold)
npm install

# Start the Vite dev server
npm run dev
```

Dashboard: http://localhost:5173

> The Vite dev server proxies `/api/*` to `localhost:8000` automatically.

---

## Detection Engine — 5-Pass Static Scanner

Every file goes through these passes in `backend/app/core/detector.py`:

| Pass | What it detects | Technique |
|------|----------------|-----------|
| **1. Agent signals** | `mcp.json`, Copilot Extension configs, system-prompt-like content | Filename allowlist + regex heuristics |
| **2. Secret scanning** | API keys, tokens, passwords, high-entropy strings | Regex + Shannon entropy (threshold 4.5 bits) |
| **3. Prompt injection** | `ignore previous instructions`, DAN jailbreaks, role-play escapes, hidden system tags | 12 regex patterns + decoded base64 check |
| **4. Obfuscation** | Zero-width chars, Unicode homoglyphs, base64-hidden payloads | Character code range scan + entropy decode |
| **5. Permission over-grant** | YAML/JSON configs with `write`/`admin`/`all repositories` access | Regex on structured config files |

### How Hidden/Obfuscated Prompts Are Detected

**Zero-width characters** (`\u200b`, `\u200c`, `\u200d`, `\u2060`, `\uFEFF`):
```python
ZERO_WIDTH_CHARS = ["\u200b", "\u200c", "\u200d", "\u2060", "\ufeff"]
zw_found = [c for c in content if c in ZERO_WIDTH_CHARS]
```
These are invisible to humans in PR reviews but are read by LLMs.

**Unicode homoglyphs** (Cyrillic letters that look like Latin):
```python
cyrillic_count = sum(1 for c in content if "\u0400" <= c <= "\u04ff")
# Сyrillic 'а' looks identical to Latin 'a' but bypasses ASCII filters
```

**Base64-encoded injections**:
```python
# Decode all base64 blobs ≥32 chars found in the file
# Re-run injection patterns on decoded content
decoded = base64.b64decode(candidate).decode("utf-8")
```

**High-entropy string extraction** (Shannon entropy):
```python
def _shannon_entropy(data, char_set):
    freq = Counter(c for c in data if c in char_set)
    return -sum((v/len) * log2(v/len) for v in freq.values())
# Strings with entropy > 4.5 bits are likely secrets
```

---

## Security Score Formula

```
score = 100
       - Σ (severity_deduction per finding)
       - 15 × (confirmed_exploitable findings)

Severity deductions:
  CRITICAL → -25 pts
  HIGH     → -12 pts
  MEDIUM   → -6 pts
  LOW      → -2 pts
  INFO     → 0 pts

Grade: A(90+) B(80+) C(70+) D(60+) F(<60)
```

---

## GitHub Integration

### Setup (GitHub App)

1. Create a GitHub App with permissions: `pull_requests: write`, `checks: write`, `contents: read`
2. Set the webhook URL to `https://your-api/api/v1/github/webhook`
3. Add secrets to your repo: `SENTRYOPS_API_URL`, `SENTRYOPS_API_KEY`

### On-demand scan in PR comments

Post a comment on any pull request:
```
/sentry scan     ← runs quick scan
/sentry deep     ← runs full red-team deep scan
```

---

## Azure Deployment

```bash
# 1. Build and push container
az acr build --registry <your-acr> --image sentryops:latest ./backend

# 2. Deploy to Container Apps
az containerapp create \
  --name sentryops-api \
  --resource-group sentryops-rg \
  --environment sentryops-env \
  --image <your-acr>.azurecr.io/sentryops:latest \
  --target-port 8000 \
  --env-vars \
    ANTHROPIC_API_KEY=secretref:anthropic-key \
    GEMINI_API_KEY=secretref:gemini-key \
    AZURE_KEYVAULT_URL=https://<vault>.vault.azure.net \
    AZURE_BLOB_CONNECTION_STRING=secretref:blob-conn
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| GitHub Integration | GitHub Actions + GitHub Apps API |
| Backend API | FastAPI + Uvicorn |
| AI Orchestration | LangGraph (state-machine multi-agent) |
| Adversarial Logic | Claude 3.5 Sonnet (Anthropic) |
| Context Reasoning | Gemini 1.5 Pro (Google) |
| Secret Validation | Azure Key Vault (MCP-style) |
| Audit Logging | Azure Blob Storage (immutable) |
| Dashboard | React + Vite |
| Containerisation | Docker → Azure Container Apps |

---

## License

MIT — see [LICENSE](./LICENSE)
