#!/usr/bin/env bash
# pre-commit-pii-guard.sh — BLOCK git commits/pushes that would expose PII.
# Called via PreToolUse hook for Bash tool.
# Receives tool input as JSON on stdin.

INPUT=$(cat)

# Extract the command string from the tool input JSON
CMD=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | sed 's/"//')

if [ -z "$CMD" ]; then
  exit 0
fi

# Only inspect git commit / push / add commands
if ! echo "$CMD" | grep -qE '(git (commit|push|add)|rtk git (commit|push|add))'; then
  exit 0
fi

# If this is git add, check if reference/ or sensitive files are being staged
if echo "$CMD" | grep -qE '(git add|rtk git add)'; then
  if echo "$CMD" | grep -qE '(reference/|\.env\.local|\.local\.(ts|json))'; then
    echo ""
    echo "🚫  PII GUARD — Blocked by .claude/hooks/pre-commit-pii-guard.sh"
    echo "   Command: $CMD"
    echo "   You are attempting to stage a PII-sensitive file."
    echo "   reference/  → contains real financial data (never commit)"
    echo "   .env.local  → contains secrets (never commit)"
    echo "   *.local.ts/json → may contain Fixture A real values"
    echo "   See CLAUDE.md §PII before proceeding."
    echo ""
    exit 2  # non-zero blocks the tool call
  fi
fi

# For git commit / push, check currently staged files
if echo "$CMD" | grep -qE '(git commit|git push|rtk git commit|rtk git push)'; then
  STAGED=$(git diff --cached --name-only 2>/dev/null)
  if echo "$STAGED" | grep -qE '^(reference/|\.env\.local|.*\.local\.(ts|json))'; then
    VIOLATING=$(echo "$STAGED" | grep -E '^(reference/|\.env\.local|.*\.local\.(ts|json))')
    echo ""
    echo "🚫  PII GUARD — Blocked by .claude/hooks/pre-commit-pii-guard.sh"
    echo "   Command  : $CMD"
    echo "   Violating files staged:"
    echo "$VIOLATING" | while read -r f; do echo "     - $f"; done
    echo "   Unstage these files before committing: git restore --staged <file>"
    echo "   See CLAUDE.md §PII for the full policy."
    echo ""
    exit 2  # non-zero blocks the tool call
  fi
fi

exit 0
