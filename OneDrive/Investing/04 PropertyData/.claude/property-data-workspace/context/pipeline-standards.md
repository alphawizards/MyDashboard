# Pipeline Standards

## Output Schema

Every scraped record must contain these fields:

| Column | Type | Description |
|--------|------|-------------|
| `postcode` | `str` | 4-digit Australian postcode |
| `suburb` | `str` | Suburb name |
| `state` | `str` | State abbreviation (e.g., `NSW`, `VIC`) |
| `vacancy_rate` | `float` | Vacancy rate as percentage |
| `median_rent_weekly` | `float` | Median weekly asking rent in AUD |
| `listings_count` | `int` | Total active property listings |
| `days_on_market` | `float` | Median days on market |
| `scraped_at` | `str` | ISO 8601 datetime (e.g., `2026-03-22T14:30:00+10:00`) |

---

## Validation Rules

Apply before saving. Invalid records must be **logged and skipped** — never silently dropped.

| Field | Rule |
|-------|------|
| `vacancy_rate` | `0 <= value <= 100` |
| `median_rent_weekly` | `value > 0` |
| `listings_count` | `value >= 0` |
| `days_on_market` | `value >= 0` |
| `postcode` | 4-digit string (regex: `^\d{4}$`) |
| All fields | No nulls / NaN values |

**On validation failure:** log at `WARNING` level with field name, value, and postcode. Skip the record. Do not raise an exception.

---

## File Naming

Output files: `data/processed/YYYY-MM-DD_<STATE>.csv`
Example: `data/processed/2026-03-22_NSW.csv`

One file per state per run. Append to existing file if a run resumes mid-state.

---

## Folder Roles

| Folder | Contents |
|--------|----------|
| `data/raw/` | Postcode source CSVs only. Never write scraped data here. |
| `data/processed/` | Scraped output CSVs + `progress.json` checkpoint file |

---

## Pipeline Failure Definition

A run is a **pipeline failure** if more than 5% of all attempted postcodes produce fatal errors.

On failure:
- Log to `pipeline.log` in the project root
- Each log entry must include: timestamp (ISO 8601), postcode, error type, and raw response snippet (first 200 chars)
- Do not abort mid-run — complete the run, then evaluate the failure threshold at the end
