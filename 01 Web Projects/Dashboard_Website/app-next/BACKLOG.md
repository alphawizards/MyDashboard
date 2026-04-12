# RetireAU app-next — Backlog

## Phase 1 polish (LOW findings from Phase 1 code review)

- [ ] Privacy page `lastUpdated` is a hardcoded string — extract to a named constant at the top of `src/app/privacy/page.tsx`
- [ ] `Header.tsx` — helper function defined after the call site; move above first use (style only)
- [ ] Emoji icon prop in UI components causes inconsistent rendering on Windows — replace with SVG icons or text labels in Phase 5 visual polish pass
