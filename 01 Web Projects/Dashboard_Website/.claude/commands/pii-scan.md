# /pii-scan

Scan currently staged git changes for potential Fixture A PII exposure before committing.

Delegates to the `pii-auditor` agent.

## What it does

1. Runs `git diff --cached --name-only` to list staged files.
2. Checks for explicitly blocked files (`reference/**`, `.env.local`, `*.local.ts`, `*.local.json`).
3. Delegates to the `pii-auditor` agent for a deeper content-level scan.
4. Reports: PASS (safe to commit) or FAIL (describe what was found and which file).

## Steps

Run `/pii-scan` before any `git commit` when you've touched files that might reference financial figures, names, or property addresses.

**This does not replace the pre-commit hook** — it is a proactive check you can run manually to get a readable report before the hook fires.
