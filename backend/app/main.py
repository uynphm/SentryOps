"""
SentryOps — FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.core.config import get_settings
from app.routers import scan, github, audit

log = structlog.get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Autonomous Security Governance & Remediation for GitHub Copilot Extensions. "
        "Dual-mode: GitHub-native Check Runs + Security-team Dashboard API."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS (permit React dev server and production domain) ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(scan.router,   prefix="/api/v1", tags=["Scan"])
app.include_router(github.router, prefix="/api/v1", tags=["GitHub"])
app.include_router(audit.router,  prefix="/api/v1", tags=["Audit"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "healthy",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
