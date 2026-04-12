# /docs-reading-order

Print the ordered reading list for the RetireAU spec docs, with status indicators.

## What it does

1. Reads `README.md` §Reading Order (the full 25-doc list).
2. Checks which docs exist in `docs/`.
3. Prints a formatted table: doc number, filename, purpose, and ✓/✗ for existence.

## Foundational Six (always read first)

| # | File | When |
|---|------|------|
| 01 | `docs/01-architecture-overview.md` | Before writing any code |
| 06 | `docs/06-implementation-plan.md` | Daily build playbook |
| 02 | `docs/02-database-schema.md` | Phase 1 — data layer |
| 07 | `docs/07-config-reference.md` | Phase 1 — CONFIG fields |
| 08 | `docs/08-calculation-engine.md` | Phase 2 — formulas |
| 10 | `docs/10-test-fixtures.md` | Phase 2+ — TDD baseline ⚠ PII |

## Steps

1. Read `README.md` to extract the full ordered list.
2. For each doc, check existence with `Glob`.
3. Print the table with ✓/✗ status.
4. Highlight any missing docs in red with: `MISSING — check README.md §Reading Order`.
