# Scraper Architecture

## Strategy Pattern

All scrapers implement `BaseScraperStrategy` (ABC, `src/core/strategies.py:19`):

```python
class BaseScraperStrategy(ABC):
    def scrape_postcode(self, postcode: str) -> Optional[pd.DataFrame]: ...
    def get_name(self) -> str: ...
```

**Concrete implementations:**

| Class | File:Line | Description |
|-------|-----------|-------------|
| `HttpTableScraper` | `strategies.py:51` | HTTP-based; delegates to `SQMScraper` |
| `BrowserScraper` | `strategies.py:97` | Headless browser (Playwright or Lightpanda) |

**Orchestration:** `FallbackScraperService` (`strategies.py:171`) accepts an ordered list of strategies and tries each in sequence until one returns a valid DataFrame.

---

## HTTP Strategy — SQMScraper

Core class: `SQMScraper` (`src/core/scraper.py:25`)

| Method | Line | Purpose |
|--------|------|---------|
| `__init__` | 37 | Init session, user-agent pool, delay range, expected columns |
| `_rotate_user_agent` | 65 | Randomly select from user-agent pool |
| `_random_delay` | 71 | Sleep 2–5s between requests |
| `_fetch_page` | 85 | Fetch HTML with retry logic |
| `_extract_tables` | 109 | Parse HTML tables into DataFrames |
| `_validate_table` | 127 | Check expected columns present and non-empty |
| `scrape_postcode` | 153 | Full scrape for one postcode |
| `save_dataframe` | 188 | Write DataFrame to CSV |
| `run_for_postcode` | 208 | Pipeline: scrape → validate → save → delay |

**Retry config:** tenacity-based in `_fetch_page`. Target spec: 5 attempts, exponential wait 2–30s, retry on `ConnectionError`, `HTTPError`, `Timeout`.

---

## Browser Fallback Strategy

`BrowserScraper` (`strategies.py:97`) supports two providers: `"playwright"` (default) or `"lightpanda"`. Runs headless. Triggered automatically by `FallbackScraperService` when `HttpTableScraper` returns `None`.

---

## Checkpoint / Resumability

Functions in `src/utils/postcode_utils.py`:

| Function | Line | Purpose |
|----------|------|---------|
| `load_postcodes` | 13 | Load all postcodes from CSV |
| `load_scraped_postcodes` | 50 | Load already-completed postcodes from tracker file |
| `mark_postcode_scraped` | 81 | Append completed postcode to tracker |
| `get_remaining_postcodes` | 98 | Diff all vs scraped to get remaining queue |

Tracker file: `data/processed/progress.json` (or text-based tracker — confirm from `postcode_utils.py` implementation).

---

## Error Classification

| Type | Examples | Behaviour |
|------|----------|-----------|
| Retriable | Network timeout, HTTP 429, HTTP 503 | tenacity retries with backoff |
| Fatal | HTTP 404, parse failure after retries, schema mismatch | Log and skip postcode |

Fatal errors count toward the 5% pipeline failure threshold (see `pipeline-standards.md`).
