#!/usr/bin/env bash
# pre-tool-pii-warn.sh — warn (but allow) when Claude reads PII-sensitive files.
# Called via PreToolUse hook for Read and Edit tools.
# Receives tool input as JSON on stdin.

INPUT=$(cat)

# Extract the file_path from the tool input JSON (simple grep approach)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//' | sed 's/"//')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Normalise to forward slashes for matching
NORM=$(echo "$FILE_PATH" | tr '\\' '/')

if echo "$NORM" | grep -qE '(reference/|docs/10-test-fixtures\.md)'; then
  echo ""
  echo "⚠  PII WARNING — CLAUDE.md §PII applies to this file"
  echo "   File : $FILE_PATH"
  echo "   Rule : Do not paste contents into commits, PRs, CI logs, or issue comments."
  echo "   Rule : Do not include real values in any committed test fixture."
  echo "   See  : CLAUDE.md §PII for the full policy."
  echo ""
  # exit 0 = warn and continue (not blocking)
fi

exit 0
