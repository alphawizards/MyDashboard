# .claude/ — Project Claude Code Config

This folder contains project-scoped Claude Code configuration for the **RetireAU** spec handoff pack.

## Folder Map

```
.claude/
├── settings.json              # shared project settings + hooks (committed)
├── settings.local.json.example # template — copy to settings.local.json (gitignored)
├── commands/                  # custom slash commands
│   ├── verify-fixture.md      # /verify-fixture  — run calc baseline
│   ├── pii-scan.md            # /pii-scan        — pre-commit PII check
│   ├── phase-next.md          # /phase-next      — show next Blueprint A phase
│   └── docs-reading-order.md  # /docs-reading-order — print doc reading list
├── agents/                    # project subagents
│   ├── spec-reviewer.md       # spec contradiction audit
│   ├── calc-porter.md         # formula port + fixture verify
│   └── pii-auditor.md        # staged-change PII scanner
├── hooks/                     # shell hooks (called by settings.json)
│   ├── pre-tool-pii-warn.sh   # warn on reads of reference/ or Fixture A
│   └── pre-commit-pii-guard.sh# block commits staging PII files
└── skills/                    # project-specific skills (placeholder)
```

## PII Policy

**Two files in this repo contain real personal financial information:**

- `reference/Retirement_Dashboard_v2.html` — frozen dashboard with real salaries, debts, property values
- `docs/10-test-fixtures.md` — Fixture A with real CONFIG values

Both are gitignored. Do not commit them, paste them into PR descriptions, or include raw values in test files.

Full policy: see `CLAUDE.md` §PII — Read Before Any Git Action.

## Local Settings Override

1. Copy `settings.local.json.example` → `settings.local.json`
2. `settings.local.json` is gitignored — safe to put personal overrides here
3. Example: temporarily allow `git push` after the PII guard passes

## Adding Commands

Create a new `.md` file in `commands/`. The filename becomes the slash command: `my-command.md` → `/my-command`.

Include: description, what it does, steps.

## Adding Agents

Create a new `.md` file in `agents/`. Include YAML frontmatter:

```yaml
---
name: agent-name
description: One-line description shown in agent picker
tools: Read, Grep, Glob   # list only tools the agent needs
---
```

## Hooks

`pre-tool-pii-warn.sh` — reads tool input JSON from stdin, warns if the target file is in `reference/` or `docs/10-test-fixtures.md`. Exit 0 (non-blocking).

`pre-commit-pii-guard.sh` — reads Bash command from stdin, blocks `git add/commit/push` if PII files are involved. Exit 2 (blocking).

Make sure both are executable (`chmod +x`) if running on Linux/macOS.
