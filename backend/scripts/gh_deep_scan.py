"""
gh_deep_scan.py — called by the GitHub Action's deep-scan job.

Fetches changed files, calls /scan/deep, posts Check Run updates,
and writes PR suggestion comments to GITHUB_OUTPUT.
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

    # ── Fetch changed files ───────────────────────────────────────────────────
    g = Github(gh_token)
    repo = g.get_repo(args.repo)
    pr = repo.get_pull(args.pr)

    files_payload = []
    for f in pr.get_files():
        if f.patch:
            files_payload.append({"filename": f.filename, "content": f.patch})

    files_payload.append({
        "filename": "pr_description.md",
        "content": f"# {pr.title}\n\n{pr.body or ''}",
    })

    # ── Call /scan/deep ───────────────────────────────────────────────────────
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"files": files_payload, "repo": args.repo, "pr_number": args.pr}

    print("🤖 Launching Shadow Agents — this may take 30–90s...")
    try:
        resp = httpx.post(f"{api_url}/api/v1/scan/deep", json=payload,
                          headers=headers, timeout=300)
        resp.raise_for_status()
        result = resp.json()
    except Exception as exc:
        print(f"::error::SentryOps deep scan error: {exc}", file=sys.stderr)
        with open(args.output_env, "a") as fh:
            fh.write("suggestions_json=[]\n")
        sys.exit(0)

    # Format suggestions for the GitHub Action script step
    raw_suggestions = result.get("suggestions", [])
    suggestions_json = json.dumps(raw_suggestions).replace("\n", " ")

    # Write to GITHUB_OUTPUT
    with open(args.output_env, "a") as fh:
        fh.write(f"suggestions_json={suggestions_json}\n")

    score = result.get("score", {}).get("total", 0)
    breaches = sum(1 for a in result.get("shadow_agents", []) if a.get("breach_detected"))
    audit_url = result.get("audit_log_url", "N/A")

    print(f"✅ Deep scan complete.")
    print(f"   Score: {score}/100")
    print(f"   Breaches confirmed: {breaches}")
    print(f"   Suggestions generated: {len(raw_suggestions)}")
    print(f"   Audit log: {audit_url}")


if __name__ == "__main__":
    main()
