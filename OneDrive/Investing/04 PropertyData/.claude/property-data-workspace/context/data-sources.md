# Data Sources

## SQM Research

**Base URL pattern:**
```
https://sqmresearch.com.au/weekly-rents.php?postcode={postcode}&t=1
```
Postcode is interpolated directly into the URL. The scraper targets tabular data rendered as HTML `<table>` elements on the page.

**Target data fields (extracted from HTML tables):**
- Vacancy rate (%)
- Median asking rent — weekly (houses and units)
- Total property listings count
- Days on market (median)

**Authentication:** None required. The scraper rotates user-agents and applies random delays (2–5s) to avoid rate limiting.

---

## Postcode Data

**Source:** Australian postcode CSV
**Storage path:** `sqm_scraper_pro/data/raw/postcodes.csv`
**Columns:** `postcode` (str, 4-digit), `state` (str), `suburb` (str)
**Fetch script:** `sqm_scraper_pro/scripts/fetch_postcodes.py`

---

## PropEquityLab API

> **TODO:** PropEquityLab API integration is not yet implemented in this codebase.
> Confirm the following before implementing:
> - Base URL (e.g., `https://api.propequitylab.com/v1/`)
> - API key env var name (e.g., `PROPEQUITYLAB_API_KEY`)
> - Endpoint structure (e.g., `/property-data/sqm/postcode/{postcode}`)
> - Request/response field names and types
> - Rate limits and auth method (Bearer token, API key header, etc.)
>
> Source of truth: PropEquityLab backend codebase or engineering team.
