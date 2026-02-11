## Data Weaver Backend (MVP)

FastAPI + DuckDB execution layer for the Data Weaver frontend.

### Features (MVP)

- Project management (single-tenant instance can still host multiple projects)
- Upload/import `CSV` and `XLSX`
- Table browsing with pagination/filter/sort
- Results: Summary + Quality
- PK/FK declaration + relation report
- Merge (FULL OUTER default) producing derived table + `_merge`
- Reshape (wide↔long) producing derived table
- Export: default `CSV`, optional `.dta`
- History + undo (clean operations)

### Field markers (facts-based)

For imported datasets (CSV/XLSX/XLS) there are no native constraints, so the backend derives the Canvas “markers” from the **actual table values** (not guesses):

- `Nullable`: column has any missing values.
  - Missing definition:
    - `VARCHAR/TEXT`: `NULL` or `''` (after `trim`)
    - numeric floats: `NULL` or `NaN`
    - other types: `NULL`
- `Unique`: **strict unique** (usable as a key) = `missing_count == 0` AND `distinct_count == row_count`.
- `Identity`: integer column that is strict-unique and looks like a sequence:
  - `min in {0,1}` AND `max - min + 1 == row_count`.
- `Primary key`: explicit PK set by user (`/tables/{id}/pk`), otherwise the backend stores a **single-column inferred PK** (best strict-unique candidate, preferring `id`/`*_id`).
- `Foreign key`: inferred when a column in table A matches a strict-unique key column in table B **by real coverage**:
  - Normalize values as `trim(cast(value as varchar))` (empty -> missing)
  - Coverage = matched_rows / non-missing_rows, threshold default `>= 0.9`

These profiles are refreshed after import/clean/merge/reshape and also when the Canvas is requested.

### Local run (dev)

1. Install Python 3.11+
2. Install deps:
   - `pip install -r backend/requirements.txt`
3. Run:
   - `uvicorn backend.app.main:app --reload --port 8000`

Backend stores data under `DATA_WEAVER_DATA_DIR` (default: `./.data-weaver`).

### Docker

- `docker compose up --build`
