"""
gh_quick_scan.py — called by the GitHub Action's quick-scan job.

Fetches changed files from the PR diff, sends them to the SentryOps
/scan/quick API, and writes results to GITHUB_OUTPUT for downstream jobs.
"""

from __future__ import annotations
import argparse
import json
import os
import sys
import httpx
from github import Github


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo",       required=True)
    parser.add_argument("--pr",         required=True, type=int)
    parser.add_argument("--sha",        required=True)
    parser.add_argument("--output-env", required=True)
    args = parser.parse_args()

    api_url = os.environ["SENTRYOPS_API_URL"].rstrip("/")
    api_key = os.environ.get("SENTRYOPS_API_KEY", "")
    gh_token = os.environ.get("GH_TOKEN", "")

    # ── Fetch changed files from GitHub ───────────────────────────────────────
    g = Github(gh_token)
    repo = g.get_repo(args.repo)
    pr = repo.get_pull(args.pr)

    files_payload = []
    for f in pr.get_files():
        if f.patch:  # only files with actual changes
            files_payload.append({
                "filename": f.filename,
                "content": f.patch,    # use the diff/patch content
            })

    # Also include PR title + body as a probe
    files_payload.append({
        "filename": "pr_description.md",
        "content": f"# {pr.title}\n\n{pr.body or ''}",
    })

    # ── Call /scan/quick ───────────────────────────────────────────────────────
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"files": files_payload, "repo": args.repo, "pr_number": args.pr}

    try:
        resp = httpx.post(f"{api_url}/api/v1/scan/quick", json=payload,
                          headers=headers, timeout=120)
        resp.raise_for_status()
        result = resp.json()
    except Exception as exc:
        print(f"::error::SentryOps API error: {exc}", file=sys.stderr)
        # Fail open — don't block PRs if SentryOps is down
        with open(args.output_env, "a") as fh:
            fh.write("score=0\nagent_signals=false\n")
            fh.write("summary=SentryOps API unavailable — scan skipped.\n")
        sys.exit(0)

    score = result.get("score", {}).get("total", 0)
    agent_signals = str(result.get("agent_signals_detected", False)).lower()
    summary = result.get("summary", "").replace("\n", "%0A")  # GH multiline escape

    # Write to GITHUB_OUTPUT
    with open(args.output_env, "a") as fh:
        fh.write(f"score={score}\n")
        fh.write(f"agent_signals={agent_signals}\n")
        fh.write(f"summary={summary}\n")

    print(f"✅ Quick scan complete. Score: {score}/100, Agent signals: {agent_signals}")


if __name__ == "__main__":
    main()
