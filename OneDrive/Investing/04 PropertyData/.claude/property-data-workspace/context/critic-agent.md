# Critic Agent — Property Data Workspace

When asked to "run the critic," execute the three rounds below in sequence.
Cross-reference against: `data-sources.md`, `scraper-architecture.md`, `pipeline-standards.md`.

Each round produces one rating:
- **Reject** — blocking issue; do not accept until resolved
- **Conditionally Accept** — minor violation; note issue, accept with required follow-up action
- **Accept** — fully compliant

---

## Round 1 — Data Integrity

**Check:**
1. Output schema matches `pipeline-standards.md` exactly (all 8 fields present, correct types)
2. All validation rules enforced in code (vacancy_rate range, rent > 0, no nulls, postcode regex)
3. No silent drops — invalid records logged at WARNING level with field/value/postcode, then skipped
4. `scraped_at` present on every record, formatted as ISO 8601

**Ratings:**
- **Reject:** Any field missing validation, or silent drop detected (record disappears without a log entry)
- **Conditionally Accept:** Validation present but incomplete (e.g., one field unchecked, timestamp present but not ISO 8601)
- **Accept:** All 8 fields validated, no silent drops, timestamps correctly formatted

---

## Round 2 — Code Quality

**Check:**
1. Type hints present on all functions (100% — no exceptions)
2. Zero `print` statements in any source file
3. `logging` module used for all output (not `print`, not `sys.stdout`)
4. No bare `except:` clauses — all exceptions must be caught by type
5. Strategy pattern correctly implemented: `BaseScraperStrategy` is an ABC, all concrete strategies inherit from it

**Ratings:**
- **Reject:** Type hints absent on >20% of functions, or any bare `except:` present
- **Conditionally Accept:** Minor violations — 1–2 missing type hints, one `print` statement remaining
- **Accept:** Fully compliant on all five checks

---

## Round 3 — Pipeline Reliability

**Check:**
1. Checkpoint resume logic present: `load_scraped_postcodes` and `mark_postcode_scraped` called correctly; scraper skips already-completed postcodes on restart
2. tenacity retry config matches spec: 5 attempts, exponential wait 2–30s, retries on `ConnectionError`, `HTTPError`, `Timeout`
3. Error classification correct: retriable errors trigger retry; fatal errors (404, parse failure, schema mismatch) log and skip without retry
4. Failure threshold enforced: fatal error count tracked across run; if >5% of postcodes fail fatally, write summary to `pipeline.log` with timestamp/postcode/error type/response snippet

**Ratings:**
- **Reject:** No checkpoint logic present, or retry config absent entirely
- **Conditionally Accept:** Checkpoint logic present but not covered by tests; retry config partially correct (wrong exception types or attempt count)
- **Accept:** Checkpoint logic tested, retry config matches spec exactly, failure threshold enforced and logged
