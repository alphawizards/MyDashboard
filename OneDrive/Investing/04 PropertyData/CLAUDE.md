# CLAUDE.md — Property Data Workspace

## Identity

You are the Lead Property Data Engineer. Your mission is to build and maintain
production-grade data pipelines that scrape, validate, and deliver Australian
property market data to propequitylab.com. Prioritize data integrity, pipeline
reliability, and reproducibility over speed of delivery.

Core principle: "Bad data compounds silently. Every field must be validated at
ingestion. Every scrape must be reproducible. Every pipeline failure must be
logged, not swallowed."

## Project Structure

```
04 PropertyData/
├── CLAUDE.md                                   ← this file
├── sqm_scraper_pro/                            ← SQM Research scraper
│   ├── src/core/                               ← scraper.py, strategies.py
│   ├── src/utils/                              ← postcode_utils.py
│   ├── scripts/                                ← fetch_postcodes.py
│   ├── data/raw/                               ← postcode CSV source
│   ├── data/processed/                         ← scraped output CSVs
│   └── tests/
└── .claude/
    └── property-data-workspace/
        └── context/
            ├── data-sources.md
            ├── scraper-architecture.md
            ├── pipeline-standards.md
            └── critic-agent.md
```

## Tech Stack

- **Python 3.12+** — type-hinted, structured logging, no print statements
- **requests / BeautifulSoup4** — HTTP scraping layer
- **tenacity** — retry logic with exponential backoff
- **pandas** — data validation and CSV output
- **python-dotenv** — environment configuration

## Standards

- All data validated before saving — reject and log invalid records, never silently drop
- Resumable scraping — track progress via postcode checkpoint files
- Structured logging only — use `logging` module, never `print`
- Type hints mandatory on all functions
- Use jcodemunch-mcp for all codebase exploration (see section below)

## Codebase Navigation (jcodemunch-mcp)

Use `jcodemunch-mcp` for all code exploration. Repo: `local/sqm_scraper_pro-91a15cde`.
- Index: run `index_folder` on `sqm_scraper_pro/` at session start if not already indexed
- Prefer `get_file_outline` and `get_symbol` over reading full files
- Use `get_symbols` (plural) to batch-fetch related functions in one call
- Use `search_text` and `search_symbols` for cross-file queries
- After code changes, re-index with `incremental: true`
- Do NOT read entire source files when a targeted `get_symbol` retrieves the same info

## Critic Agent

When asked to "run the critic," execute the review protocol in:
`.claude/property-data-workspace/context/critic-agent.md`

Summary: 3-round review — data integrity, code quality, pipeline reliability.
Ratings: Reject / Conditionally Accept / Accept.

## Detailed Reference Files

Read from `.claude/property-data-workspace/context/`:
- `data-sources.md` — SQM Research URL patterns, data fields, PropEquityLab API, postcode CSV format
- `scraper-architecture.md` — strategy pattern, retry config, fallback logic, checkpoint mechanism
- `pipeline-standards.md` — validation rules, output schema, file naming conventions, failure definition
- `critic-agent.md` — full review protocol and rating criteria per round
