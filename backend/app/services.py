from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Literal

import duckdb
import pandas as pd
import polars as pl
import pyreadstat

from .db import connect
from .schemas import FieldOut
from .utils import dedupe_names, new_id, quote_ident, sanitize_stata_varname, utcnow


def _duck_type_to_field_type(duck_type: str) -> str:
    t = duck_type.upper()
    if t in {"INTEGER", "INT", "INT4"}:
        return "int4"
    if t in {"BIGINT", "INT8"}:
        return "int8"
    if t in {"DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL", "HUGEINT"}:
        return "float8"
    if t in {"BOOLEAN"}:
        return "boolean"
    if t in {"DATE"}:
        return "date"
    if t in {"TIMESTAMP", "TIMESTAMP_S"}:
        return "timestamp"
    if t in {"TIMESTAMP_TZ", "TIMESTAMPTZ"}:
        return "timestamptz"
    if t in {"VARCHAR"}:
        return "varchar"
    if t in {"TEXT"}:
        return "text"
    return "string"


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def _active_physical_name(conn: duckdb.DuckDBPyConnection, table_id: str) -> str:
    row = conn.execute(
        """
        select physical_name
        from dw_meta.table_versions
        where table_id = ? and is_active = true
        limit 1
        """,
        [table_id],
    ).fetchone()
    if not row:
        raise KeyError(f"Unknown table_id: {table_id}")
    return row[0]


def _list_columns(conn: duckdb.DuckDBPyConnection, physical: str) -> list[tuple[str, str, bool]]:
    rows = conn.execute(f"pragma table_info('{physical}')").fetchall()
    out: list[tuple[str, str, bool]] = []
    for _, name, col_type, notnull, *_ in rows:
        out.append((name, col_type, not bool(notnull)))
    return out


def _missing_count(conn: duckdb.DuckDBPyConnection, physical: str, col: str) -> int:
    q = f"select sum(case when {quote_ident(col)} is null then 1 else 0 end) from {quote_ident(physical)}"
    return int(conn.execute(q).fetchone()[0] or 0)


def _missing_predicate(col: str, duck_type: str) -> str:
    qt = quote_ident(col)
    t = duck_type.upper()
    if t in {"VARCHAR", "TEXT"}:
        return f"{qt} is null or trim(cast({qt} as varchar)) = ''"
    if t in {"DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL"}:
        return f"{qt} is null or isnan({qt})"
    return f"{qt} is null"


def _distinct_value_expr(col: str, duck_type: str) -> str:
    qt = quote_ident(col)
    t = duck_type.upper()
    if t in {"VARCHAR", "TEXT"}:
        return f"nullif(trim(cast({qt} as varchar)), '')"
    if t in {"DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL"}:
        return f"case when {qt} is null or isnan({qt}) then null else {qt} end"
    return qt


def refresh_column_profiles(conn: duckdb.DuckDBPyConnection, table_id: str) -> None:
    physical = _active_physical_name(conn, table_id)
    row_count = int(conn.execute(f"select count(*) from {quote_ident(physical)}").fetchone()[0] or 0)
    cols = _list_columns(conn, physical)

    conn.execute("delete from dw_meta.column_profiles where table_id = ?", [table_id])
    now = utcnow()
    for col_name, col_type, _nullable_from_schema in cols:
        missing_pred = _missing_predicate(col_name, col_type)
        missing_count = int(
            conn.execute(
                f"select sum(case when {missing_pred} then 1 else 0 end) from {quote_ident(physical)}"
            ).fetchone()[0]
            or 0
        )
        distinct_count = int(
            conn.execute(
                f"select count(distinct {_distinct_value_expr(col_name, col_type)}) from {quote_ident(physical)}"
            ).fetchone()[0]
            or 0
        )
        inferred_nullable = missing_count > 0
        is_unique = bool(row_count > 0 and missing_count == 0 and distinct_count == row_count)

        is_identity = False
        t = col_type.upper()
        if is_unique and t in {"INTEGER", "INT", "INT4", "BIGINT", "INT8"} and row_count > 0:
            minmax = conn.execute(
                f"select min({quote_ident(col_name)}), max({quote_ident(col_name)}) from {quote_ident(physical)}"
            ).fetchone()
            vmin = int(minmax[0]) if minmax[0] is not None else None
            vmax = int(minmax[1]) if minmax[1] is not None else None
            if vmin in {0, 1} and vmax is not None and (vmax - vmin + 1) == row_count:
                is_identity = True

        conn.execute(
            """
            insert into dw_meta.column_profiles
              (table_id, column_name, row_count, missing_count, distinct_count, is_unique, is_identity, inferred_nullable, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                table_id,
                col_name,
                row_count,
                missing_count,
                distinct_count,
                bool(is_unique),
                bool(is_identity),
                bool(inferred_nullable),
                now,
            ],
        )


def _load_column_profiles(conn: duckdb.DuckDBPyConnection, table_id: str) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        """
        select column_name, row_count, missing_count, distinct_count, is_unique, is_identity, inferred_nullable
        from dw_meta.column_profiles
        where table_id = ?
        """,
        [table_id],
    ).fetchall()
    out: dict[str, dict[str, Any]] = {}
    for name, row_count, missing_count, distinct_count, is_unique, is_identity, inferred_nullable in rows:
        out[str(name)] = {
            "row_count": int(row_count),
            "missing_count": int(missing_count),
            "distinct_count": int(distinct_count),
            "is_unique": bool(is_unique),
            "is_identity": bool(is_identity),
            "inferred_nullable": bool(inferred_nullable),
        }
    return out


def _load_primary_key_fields(conn: duckdb.DuckDBPyConnection, table_id: str) -> list[str] | None:
    row = conn.execute("select fields_json from dw_meta.primary_keys where table_id = ?", [table_id]).fetchone()
    if row:
        return list(json.loads(row[0]))
    row = conn.execute(
        "select fields_json from dw_meta.primary_keys_inferred where table_id = ?",
        [table_id],
    ).fetchone()
    if row:
        return list(json.loads(row[0]))
    return None


def refresh_inferred_primary_key(conn: duckdb.DuckDBPyConnection, table_id: str) -> list[str] | None:
    # Only infer when user hasn't explicitly set PK.
    explicit = conn.execute("select 1 from dw_meta.primary_keys where table_id = ? limit 1", [table_id]).fetchone()
    if explicit:
        return None

    profiles = _load_column_profiles(conn, table_id)
    candidates = [
        col
        for col, p in profiles.items()
        if p["row_count"] > 0 and p["is_unique"] and (not p["inferred_nullable"])
    ]
    if not candidates:
        conn.execute("delete from dw_meta.primary_keys_inferred where table_id = ?", [table_id])
        return None

    def rank(name: str) -> tuple[int, str]:
        n = name.lower()
        if n == "id":
            return (0, n)
        if n.endswith("_id"):
            return (1, n)
        return (2, n)

    best = sorted(candidates, key=rank)[0]
    fields = [best]
    conn.execute(
        "insert or replace into dw_meta.primary_keys_inferred (table_id, fields_json, created_at) values (?, ?, ?)",
        [table_id, _json_dumps(fields), utcnow()],
    )
    return fields


def _stable_relation_id(fk_table_id: str, fk_fields: list[str], pk_table_id: str, pk_fields: list[str]) -> str:
    raw = f"{fk_table_id}|{json.dumps(fk_fields, ensure_ascii=False)}|{pk_table_id}|{json.dumps(pk_fields, ensure_ascii=False)}"
    h = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"rel-inf-{h}"


def _normalized_key_expr(col: str) -> str:
    qt = quote_ident(col)
    return f"nullif(trim(cast({qt} as varchar)), '')"


def refresh_inferred_relations(conn: duckdb.DuckDBPyConnection, coverage_threshold: float = 0.9) -> None:
    # Exclude derived tables (merge/reshape results) — they already contain columns
    # from source tables, so inferring relations from them creates spurious edges.
    table_ids = [r[0] for r in conn.execute(
        "select id from dw_meta.tables where source_type != 'derived'"
    ).fetchall()]
    if not table_ids:
        return

    # Ensure profiles exist (used for uniqueness and nullability checks).
    for tid in table_ids:
        if not conn.execute(
            "select 1 from dw_meta.column_profiles where table_id = ? limit 1",
            [tid],
        ).fetchone():
            refresh_column_profiles(conn, tid)
        refresh_inferred_primary_key(conn, tid)

    # Build candidate PK columns by table (single-column only for MVP inference).
    pk_candidates: dict[str, set[str]] = {}
    for tid in table_ids:
        fields = _load_primary_key_fields(conn, tid)
        if fields and len(fields) == 1:
            pk_candidates[tid] = {fields[0]}
            continue
        prof = _load_column_profiles(conn, tid)
        pk_candidates[tid] = {
            c
            for c, p in prof.items()
            if p["row_count"] > 0 and p["is_unique"] and (not p["inferred_nullable"])
        }

    conn.execute("delete from dw_meta.relation_edges_inferred")
    now = utcnow()

    # Infer FK->PK edges where a column name matches a PK-candidate in another table,
    # and actual data shows high coverage (facts-based).
    for fk_tid in table_ids:
        fk_physical = _active_physical_name(conn, fk_tid)
        fk_cols = {c[0] for c in _list_columns(conn, fk_physical)}
        fk_profiles = _load_column_profiles(conn, fk_tid)

        for pk_tid in table_ids:
            if pk_tid == fk_tid:
                continue
            pk_cols = pk_candidates.get(pk_tid) or set()
            if not pk_cols:
                continue

            pk_physical = _active_physical_name(conn, pk_tid)
            for shared_col in sorted(set(fk_cols) & set(pk_cols)):
                # Skip if FK column is entirely missing.
                fk_prof = fk_profiles.get(shared_col)
                if not fk_prof or fk_prof["distinct_count"] == 0:
                    continue

                fk_key = _normalized_key_expr(shared_col)
                pk_key = _normalized_key_expr(shared_col)

                coverage_row = conn.execute(
                    f"""
                    with
                      fk as (
                        select {fk_key} as k
                        from {quote_ident(fk_physical)}
                        where {fk_key} is not null
                      ),
                      pk as (
                        select distinct {pk_key} as k
                        from {quote_ident(pk_physical)}
                        where {pk_key} is not null
                      )
                    select
                      sum(case when pk.k is not null then 1 else 0 end) as matched,
                      count(*) as total
                    from fk
                    left join pk using (k)
                    """
                ).fetchone()
                matched = int(coverage_row[0] or 0)
                total = int(coverage_row[1] or 0)
                if total == 0:
                    continue
                coverage = matched / total
                if coverage < coverage_threshold:
                    continue

                # Cardinality: FK uniqueness determines 1:1 vs m:1 (FK -> PK direction).
                cardinality = "1:1" if bool(fk_prof["is_unique"] and (not fk_prof["inferred_nullable"])) else "m:1"

                rid = _stable_relation_id(fk_tid, [shared_col], pk_tid, [shared_col])
                conn.execute(
                    """
                    insert or replace into dw_meta.relation_edges_inferred
                      (id, fk_table_id, fk_fields_json, pk_table_id, pk_fields_json, cardinality, coverage, created_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        rid,
                        fk_tid,
                        _json_dumps([shared_col]),
                        pk_tid,
                        _json_dumps([shared_col]),
                        cardinality,
                        float(coverage),
                        now,
                    ],
                )


def refresh_inference(conn: duckdb.DuckDBPyConnection) -> None:
    table_ids = [r[0] for r in conn.execute("select id from dw_meta.tables").fetchall()]
    for tid in table_ids:
        refresh_column_profiles(conn, tid)
        refresh_inferred_primary_key(conn, tid)
    refresh_inferred_relations(conn)


def _physical_name(table_id: str, version: int) -> str:
    # Ensure the on-disk physical table name is a safe SQL identifier.
    safe = "".join(ch if (ch.isalnum() or ch == "_") else "_" for ch in table_id)
    return f"t_{safe}_v{version}"


def get_table_meta(conn: duckdb.DuckDBPyConnection, table_id: str) -> dict[str, Any]:
    table_row = conn.execute(
        """
        select id, name, source_type, source_file_id, dirty
        from dw_meta.tables
        where id = ?
        """,
        [table_id],
    ).fetchone()
    if not table_row:
        raise KeyError(f"Unknown table_id: {table_id}")

    physical = _active_physical_name(conn, table_id)
    profiles = _load_column_profiles(conn, table_id)
    if not profiles:
        refresh_column_profiles(conn, table_id)
        profiles = _load_column_profiles(conn, table_id)

    row_count = next(iter(profiles.values()), {}).get("row_count")
    if row_count is None:
        row_count = int(conn.execute(f"select count(*) from {quote_ident(physical)}").fetchone()[0] or 0)
    else:
        row_count = int(row_count)

    pk_fields: set[str] = set()
    pk_row = conn.execute("select fields_json from dw_meta.primary_keys where table_id = ?", [table_id]).fetchone()
    if pk_row:
        pk_fields = set(json.loads(pk_row[0]))
    if not pk_fields:
        pk_inf = conn.execute(
            "select fields_json from dw_meta.primary_keys_inferred where table_id = ?",
            [table_id],
        ).fetchone()
        if pk_inf:
            pk_fields = set(json.loads(pk_inf[0]))

    fk_rows = conn.execute(
        """
        select fk_fields_json, pk_table_id, pk_fields_json
        from dw_meta.relation_edges
        where fk_table_id = ?
        """,
        [table_id],
    ).fetchall()
    fk_rows_inf = conn.execute(
        """
        select fk_fields_json, pk_table_id, pk_fields_json
        from dw_meta.relation_edges_inferred
        where fk_table_id = ?
        """,
        [table_id],
    ).fetchall()
    fk_by_field: dict[str, tuple[str, str]] = {}
    for fk_fields_json, pk_table_id, pk_fields_json in [*fk_rows, *fk_rows_inf]:
        fk_fields = json.loads(fk_fields_json)
        pk_fields_mapped = json.loads(pk_fields_json)
        for i, fk_field in enumerate(fk_fields):
            ref_field = pk_fields_mapped[min(i, len(pk_fields_mapped) - 1)]
            fk_by_field[fk_field] = (pk_table_id, ref_field)

    fields: list[FieldOut] = []
    cols = _list_columns(conn, physical)
    for col_name, col_type, nullable in cols:
        prof = profiles.get(col_name)
        if prof:
            missing = int(prof["missing_count"])
            missing_rate = (missing / row_count) if row_count else 0.0
            nullable = bool(prof["inferred_nullable"])
            is_unique = bool(prof["is_unique"])
            is_identity = bool(prof["is_identity"])
        else:
            missing = _missing_count(conn, physical, col_name)
            missing_rate = (missing / row_count) if row_count else 0.0
            is_unique = False
            is_identity = False
        ref = fk_by_field.get(col_name)
        is_pk = col_name in pk_fields
        fields.append(
            FieldOut(
                name=col_name,
                type=_duck_type_to_field_type(col_type),
                nullable=nullable,
                isPrimaryKey=is_pk,
                isUnique=is_unique or None,
                isIdentity=is_identity or None,
                isForeignKey=(ref is not None) or None,
                refTable=ref[0] if ref else None,
                refField=ref[1] if ref else None,
                missingCount=missing,
                missingRate=missing_rate,
            )
        )

    return {
        "id": table_row[0],
        "name": table_row[1],
        "fields": [f.model_dump() for f in fields],
        "rowCount": row_count,
        "sourceType": table_row[2],
        "dirty": bool(table_row[4]),
        "sourceFileId": table_row[3],
    }


def list_tables(conn: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = conn.execute("select id from dw_meta.tables order by updated_at desc").fetchall()
    return [get_table_meta(conn, r[0]) for r in rows]


def list_files(conn: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "select id, name, type, size, updated_at from dw_meta.files order by updated_at desc"
    ).fetchall()
    return [
        {"id": r[0], "name": r[1], "type": r[2], "size": int(r[3]), "updatedAt": r[4]}
        for r in rows
    ]


def import_csv(conn: duckdb.DuckDBPyConnection, file_id: str, table_id: str, table_name: str, csv_path: Path) -> None:
    physical = _physical_name(table_id, 1)
    conn.execute(
        f"create table {quote_ident(physical)} as select * from read_csv_auto(?, header=true)",
        [str(csv_path)],
    )
    now = utcnow()
    conn.execute(
        """
        insert into dw_meta.tables (id, name, source_type, source_file_id, dirty, created_at, updated_at)
        values (?, ?, 'imported', ?, false, ?, ?)
        """,
        [table_id, table_name, file_id, now, now],
    )
    conn.execute(
        """
        insert into dw_meta.table_versions (id, table_id, version, physical_name, op_log_id, created_at, is_active)
        values (?, ?, 1, ?, null, ?, true)
        """,
        [new_id("ver"), table_id, physical, now],
    )


def import_xlsx(conn: duckdb.DuckDBPyConnection, file_id: str, table_id: str, table_name: str, xlsx_path: Path) -> None:
    physical = _physical_name(table_id, 1)
    df = pd.read_excel(xlsx_path)
    conn.register("tmp_import_df", df)
    conn.execute(f"create table {quote_ident(physical)} as select * from tmp_import_df")
    conn.unregister("tmp_import_df")
    now = utcnow()
    conn.execute(
        """
        insert into dw_meta.tables (id, name, source_type, source_file_id, dirty, created_at, updated_at)
        values (?, ?, 'imported', ?, false, ?, ?)
        """,
        [table_id, table_name, file_id, now, now],
    )
    conn.execute(
        """
        insert into dw_meta.table_versions (id, table_id, version, physical_name, op_log_id, created_at, is_active)
        values (?, ?, 1, ?, null, ?, true)
        """,
        [new_id("ver"), table_id, physical, now],
    )


def query_rows(
  conn: duckdb.DuckDBPyConnection,
  table_id: str,
  offset: int,
  limit: int,
  filters: list[dict[str, Any]],
  sort: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], int]:
    physical = _active_physical_name(conn, table_id)
    columns = [c[0] for c in _list_columns(conn, physical)]
    allowed = set(columns)

    where_parts: list[str] = []
    params: list[Any] = []
    for f in filters:
        field = f["field"]
        if field not in allowed:
            raise ValueError(f"Unknown field: {field}")
        op = f["op"]
        if op == "isnull":
            where_parts.append(f"{quote_ident(field)} is null")
        elif op == "notnull":
            where_parts.append(f"{quote_ident(field)} is not null")
        elif op == "contains":
            where_parts.append(f"{quote_ident(field)} ilike ?")
            params.append(f"%{f.get('value','')}%")
        elif op == "in":
            values = f.get("value") or []
            if not isinstance(values, list) or not values:
                where_parts.append("false")
            else:
                where_parts.append(f"{quote_ident(field)} in ({','.join(['?'] * len(values))})")
                params.extend(values)
        elif op == "between":
            v = f.get("value") or []
            if not isinstance(v, list) or len(v) != 2:
                raise ValueError("between requires [low, high]")
            where_parts.append(f"{quote_ident(field)} between ? and ?")
            params.extend([v[0], v[1]])
        else:
            sql_op = {
                "eq": "=",
                "neq": "!=",
                "lt": "<",
                "lte": "<=",
                "gt": ">",
                "gte": ">=",
            }.get(op)
            if not sql_op:
                raise ValueError(f"Unsupported op: {op}")
            where_parts.append(f"{quote_ident(field)} {sql_op} ?")
            params.append(f.get("value"))

    where_sql = f"where {' and '.join(where_parts)}" if where_parts else ""

    order_parts: list[str] = []
    for s in sort:
        field = s["field"]
        if field not in allowed:
            raise ValueError(f"Unknown sort field: {field}")
        direction = s.get("direction", "asc").lower()
        if direction not in {"asc", "desc"}:
            raise ValueError("direction must be asc|desc")
        order_parts.append(f"{quote_ident(field)} {direction}")
    order_sql = f"order by {', '.join(order_parts)}" if order_parts else ""

    total = int(conn.execute(f"select count(*) from {quote_ident(physical)} {where_sql}", params).fetchone()[0])
    df = conn.execute(
        f"select * from {quote_ident(physical)} {where_sql} {order_sql} limit ? offset ?",
        [*params, limit, offset],
    ).fetchdf()

    # FastAPI/Pydantic serialization can choke on pandas/numpy scalar types.
    # Normalize to plain Python types (datetime, int/float/str/bool/None).
    rows: list[dict[str, Any]] = df.to_dict(orient="records")
    try:
        import pandas as _pd  # type: ignore
        import numpy as _np  # type: ignore

        def _norm(v: Any) -> Any:
            if v is None:
                return None
            # pandas missing
            if v is _pd.NaT:
                return None
            # pandas Timestamp -> python datetime
            if isinstance(v, _pd.Timestamp):
                return v.to_pydatetime()
            # numpy scalar -> python scalar
            if isinstance(v, _np.generic):
                return v.item()
            # NaN -> None (keep consistent with null semantics)
            if isinstance(v, float) and _pd.isna(v):
                return None
            return v

        rows = [{k: _norm(v) for k, v in r.items()} for r in rows]
    except Exception:
        # Best-effort normalization; if deps missing, return raw.
        pass

    return rows, total


def compute_summary(conn: duckdb.DuckDBPyConnection, table_id: str) -> dict[str, Any]:
    physical = _active_physical_name(conn, table_id)
    name = conn.execute("select name from dw_meta.tables where id = ?", [table_id]).fetchone()[0]
    cols = _list_columns(conn, physical)
    numeric_stats: list[dict[str, Any]] = []
    categorical_stats: list[dict[str, Any]] = []
    for col, col_type, _ in cols:
        duck_t = col_type.upper()
        missing = int(
            conn.execute(
                f"select sum(case when {quote_ident(col)} is null then 1 else 0 end) from {quote_ident(physical)}"
            ).fetchone()[0]
            or 0
        )
        if duck_t in {"INTEGER", "INT", "INT4", "BIGINT", "INT8", "DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL"}:
            row = conn.execute(
                f"""
                select
                  count({quote_ident(col)}) as count,
                  avg({quote_ident(col)}) as mean,
                  stddev_samp({quote_ident(col)}) as std,
                  min({quote_ident(col)}) as min,
                  quantile_cont({quote_ident(col)}, 0.25) as p25,
                  median({quote_ident(col)}) as median,
                  quantile_cont({quote_ident(col)}, 0.75) as p75,
                  max({quote_ident(col)}) as max
                from {quote_ident(physical)}
                """
            ).fetchone()
            numeric_stats.append(
                {
                    "field": col,
                    "count": int(row[0] or 0),
                    "mean": float(row[1] or 0.0),
                    "std": float(row[2] or 0.0),
                    "min": float(row[3] or 0.0),
                    "p25": float(row[4] or 0.0),
                    "median": float(row[5] or 0.0),
                    "p75": float(row[6] or 0.0),
                    "max": float(row[7] or 0.0),
                    "missing": missing,
                }
            )
        else:
            unique_count = int(
                conn.execute(f"select count(distinct {quote_ident(col)}) from {quote_ident(physical)}").fetchone()[0]
                or 0
            )
            top = conn.execute(
                f"""
                select {quote_ident(col)} as value, count(*) as count
                from {quote_ident(physical)}
                where {quote_ident(col)} is not null
                group by {quote_ident(col)}
                order by count desc
                limit 10
                """
            ).fetchdf()
            categorical_stats.append(
                {
                    "field": col,
                    "uniqueCount": unique_count,
                    "topValues": top.to_dict(orient="records"),
                    "missing": missing,
                }
            )

    return {
        "tableId": table_id,
        "tableName": name,
        "numericStats": numeric_stats,
        "categoricalStats": categorical_stats,
        "timestamp": utcnow(),
    }


def compute_quality(conn: duckdb.DuckDBPyConnection, table_id: str, keys: list[str] | None) -> dict[str, Any]:
    physical = _active_physical_name(conn, table_id)
    name = conn.execute("select name from dw_meta.tables where id = ?", [table_id]).fetchone()[0]
    total_rows = int(conn.execute(f"select count(*) from {quote_ident(physical)}").fetchone()[0])
    cols = _list_columns(conn, physical)

    missing_by_column: list[dict[str, Any]] = []
    for col, _, _ in cols:
        missing = _missing_count(conn, physical, col)
        missing_by_column.append(
            {"field": col, "count": missing, "rate": (missing / total_rows) if total_rows else 0.0}
        )
    missing_by_column.sort(key=lambda x: x["count"], reverse=True)

    key_conflicts: list[dict[str, Any]] = []
    pk_row = conn.execute("select fields_json from dw_meta.primary_keys where table_id = ?", [table_id]).fetchone()
    pk_fields = json.loads(pk_row[0]) if pk_row else []
    if pk_fields:
        key_expr = " || '␟' || ".join([f"coalesce(cast({quote_ident(k)} as varchar),'')" for k in pk_fields])
        dup = int(
            conn.execute(f"select count(*) - count(distinct ({key_expr})) from {quote_ident(physical)}").fetchone()[0]
            or 0
        )
        if dup > 0:
            key_conflicts.append({"key": pk_fields, "message": f"Primary key is not unique: {dup} duplicate rows"})

    duplicates_by_key: list[dict[str, Any]] = []
    if keys:
        for k in keys:
            if k not in {c[0] for c in cols}:
                raise ValueError(f"Unknown key field: {k}")
        key_list = ", ".join([quote_ident(k) for k in keys])
        dup_count = int(
            conn.execute(
                f"select sum(case when c>1 then c-1 else 0 end) from (select count(*) as c from {quote_ident(physical)} group by {key_list})"
            ).fetchone()[0]
            or 0
        )
        duplicates_by_key.append(
            {
                "key": keys,
                "count": dup_count,
                "rate": (dup_count / total_rows) if total_rows else 0.0,
            }
        )

    type_issues: list[dict[str, Any]] = []
    for col, col_type, _ in cols:
        if col_type.upper() not in {"VARCHAR", "TEXT"}:
            continue
        total_nonnull = int(
            conn.execute(f"select count(*) from {quote_ident(physical)} where {quote_ident(col)} is not null").fetchone()[
                0
            ]
            or 0
        )
        if total_nonnull == 0:
            continue
        numeric_ok = int(
            conn.execute(
                f"select count(*) from {quote_ident(physical)} where {quote_ident(col)} is not null and try_cast({quote_ident(col)} as double) is not null"
            ).fetchone()[0]
            or 0
        )
        date_ok = int(
            conn.execute(
                f"select count(*) from {quote_ident(physical)} where {quote_ident(col)} is not null and try_cast({quote_ident(col)} as date) is not null"
            ).fetchone()[0]
            or 0
        )
        issues: list[str] = []
        if 0.8 <= (numeric_ok / total_nonnull) < 1.0:
            issues.append(f"Some values look numeric but fail parsing ({total_nonnull - numeric_ok} bad)")
        if 0.8 <= (date_ok / total_nonnull) < 1.0:
            issues.append(f"Some values look like dates but fail parsing ({total_nonnull - date_ok} bad)")
        if issues:
            type_issues.append({"field": col, "issues": issues})

    return {
        "tableId": table_id,
        "tableName": name,
        "totalRows": total_rows,
        "totalColumns": len(cols),
        "missingByColumn": missing_by_column,
        "duplicatesByKey": duplicates_by_key,
        "typeIssues": type_issues,
        "keyConflicts": key_conflicts,
        "timestamp": utcnow(),
    }


def set_primary_key(conn: duckdb.DuckDBPyConnection, table_id: str, fields: list[str]) -> None:
    physical = _active_physical_name(conn, table_id)
    cols = {c[0] for c in _list_columns(conn, physical)}
    for f in fields:
        if f not in cols:
            raise ValueError(f"Unknown field: {f}")
    conn.execute(
        "insert or replace into dw_meta.primary_keys (table_id, fields_json, created_at) values (?, ?, ?)",
        [table_id, _json_dumps(fields), utcnow()],
    )


def create_relation(conn: duckdb.DuckDBPyConnection, payload: dict[str, Any]) -> dict[str, Any]:
    rid = new_id("rel")
    conn.execute(
        """
        insert into dw_meta.relation_edges
          (id, fk_table_id, fk_fields_json, pk_table_id, pk_fields_json, cardinality, created_at)
        values (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            rid,
            payload["fkTableId"],
            _json_dumps(payload["fkFields"]),
            payload["pkTableId"],
            _json_dumps(payload["pkFields"]),
            payload["cardinality"],
            utcnow(),
        ],
    )
    return {"id": rid, **payload}


def list_relations(conn: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    explicit_rows = conn.execute(
        """
        select id, fk_table_id, fk_fields_json, pk_table_id, pk_fields_json, cardinality, created_at
        from dw_meta.relation_edges
        order by created_at desc
        """
    ).fetchall()
    inferred_rows = conn.execute(
        """
        select id, fk_table_id, fk_fields_json, pk_table_id, pk_fields_json, cardinality, created_at
        from dw_meta.relation_edges_inferred
        order by created_at desc
        """
    ).fetchall()

    explicit_keys = {
        (fk_tid, fk_json, pk_tid, pk_json)
        for _rid, fk_tid, fk_json, pk_tid, pk_json, _card, _ts in explicit_rows
    }

    rows = [*explicit_rows, *[r for r in inferred_rows if (r[1], r[2], r[3], r[4]) not in explicit_keys]]
    out: list[dict[str, Any]] = []
    for rid, fk_tid, fk_json, pk_tid, pk_json, card, _ts in rows:
        out.append(
            {
                "id": rid,
                "fkTableId": fk_tid,
                "fkFields": json.loads(fk_json),
                "pkTableId": pk_tid,
                "pkFields": json.loads(pk_json),
                "cardinality": card,
            }
        )
    return out


def relation_report(conn: duckdb.DuckDBPyConnection, relation_id: str) -> dict[str, Any]:
    row = conn.execute(
        """
        select fk_table_id, fk_fields_json, pk_table_id, pk_fields_json
        from dw_meta.relation_edges
        where id = ?
        """,
        [relation_id],
    ).fetchone()
    if not row:
        row = conn.execute(
            """
            select fk_table_id, fk_fields_json, pk_table_id, pk_fields_json
            from dw_meta.relation_edges_inferred
            where id = ?
            """,
            [relation_id],
        ).fetchone()
    if not row:
        raise KeyError("Unknown relation")
    fk_table_id, fk_fields_json, pk_table_id, pk_fields_json = row
    fk_fields = json.loads(fk_fields_json)
    pk_fields = json.loads(pk_fields_json)
    if len(fk_fields) != len(pk_fields):
        raise ValueError("FK fields and PK fields length mismatch")

    fk_physical = _active_physical_name(conn, fk_table_id)
    pk_physical = _active_physical_name(conn, pk_table_id)

    fk_nonnull_pred = " and ".join([f"{quote_ident(f)} is not null" for f in fk_fields]) or "true"
    join_pred = " and ".join(
        [f"l.{quote_ident(fk_fields[i])} = r.{quote_ident(pk_fields[i])}" for i in range(len(fk_fields))]
    )

    coverage_row = conn.execute(
        f"""
        select
          sum(case when r.__in_right = 1 then 1 else 0 end) as matched,
          count(*) as total
        from (select *, 1 as __in_left from {quote_ident(fk_physical)} where {fk_nonnull_pred}) l
        left join (select *, 1 as __in_right from {quote_ident(pk_physical)}) r
          on {join_pred}
        """
    ).fetchone()
    matched = int(coverage_row[0] or 0)
    total = int(coverage_row[1] or 0)
    coverage = (matched / total) if total else 0.0

    fk_missing = int(
        conn.execute(
            f"select sum(case when not ({fk_nonnull_pred}) then 1 else 0 end) from {quote_ident(fk_physical)}"
        ).fetchone()[0]
        or 0
    )

    fk_key_expr = " || '␟' || ".join([f"coalesce(cast({quote_ident(k)} as varchar),'')" for k in fk_fields])
    fk_dup_rows = int(
        conn.execute(
            f"select sum(case when c>1 then c-1 else 0 end) from (select count(*) as c from {quote_ident(fk_physical)} group by ({fk_key_expr}))"
        ).fetchone()[0]
        or 0
    )
    pk_key_expr = " || '␟' || ".join([f"coalesce(cast({quote_ident(k)} as varchar),'')" for k in pk_fields])
    pk_dup_rows = int(
        conn.execute(
            f"select sum(case when c>1 then c-1 else 0 end) from (select count(*) as c from {quote_ident(pk_physical)} group by ({pk_key_expr}))"
        ).fetchone()[0]
        or 0
    )

    return {
        "relationId": relation_id,
        "fkTableId": fk_table_id,
        "pkTableId": pk_table_id,
        "coverage": coverage,
        "fkMissing": fk_missing,
        "fkDuplicateRows": fk_dup_rows,
        "pkDuplicateRows": pk_dup_rows,
        "timestamp": utcnow(),
    }


def _next_version(conn: duckdb.DuckDBPyConnection, table_id: str) -> int:
    row = conn.execute("select max(version) from dw_meta.table_versions where table_id = ?", [table_id]).fetchone()
    return int(row[0] or 0) + 1


def _set_active_version(conn: duckdb.DuckDBPyConnection, table_id: str, new_version_id: str) -> None:
    conn.execute("update dw_meta.table_versions set is_active = false where table_id = ?", [table_id])
    conn.execute(
        "update dw_meta.table_versions set is_active = true where id = ? and table_id = ?",
        [new_version_id, table_id],
    )
    conn.execute("update dw_meta.tables set updated_at = ? where id = ?", [utcnow(), table_id])


def clean_drop_missing(conn: duckdb.DuckDBPyConnection, table_id: str, fields: list[str]) -> dict[str, Any]:
    return clean_table(conn, table_id, action="drop-missing", fields=fields)


def clean_table(
    conn: duckdb.DuckDBPyConnection,
    table_id: str,
    action: str,
    fields: list[str],
    filters: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    physical = _active_physical_name(conn, table_id)
    cols = _list_columns(conn, physical)
    col_names = [c[0] for c in cols]
    allowed = set(col_names)
    for f in fields:
        if f not in allowed:
            raise ValueError(f"Unknown field: {f}")

    new_ver = _next_version(conn, table_id)
    new_physical = _physical_name(table_id, new_ver)

    # Optional row scope (Scoped Apply)
    filters = filters or []
    where_parts: list[str] = []
    where_params: list[Any] = []
    if filters:
        # Reuse the same filter semantics as query_rows
        for f in filters:
            field = f["field"]
            if field not in allowed:
                raise ValueError(f"Unknown field: {field}")
            op = f["op"]
            if op == "isnull":
                where_parts.append(f"{quote_ident(field)} is null")
            elif op == "notnull":
                where_parts.append(f"{quote_ident(field)} is not null")
            elif op == "contains":
                where_parts.append(f"{quote_ident(field)} ilike ?")
                where_params.append(f"%{f.get('value','')}%")
            elif op == "eq":
                where_parts.append(f"{quote_ident(field)} = ?")
                where_params.append(f.get("value"))
            elif op == "neq":
                where_parts.append(f"{quote_ident(field)} != ?")
                where_params.append(f.get("value"))
            else:
                raise ValueError(f"Unsupported filter op for clean: {op}")

    scope_sql = f"({' and '.join(where_parts)})" if where_parts else "true"

    where_sql = ""
    select_exprs: list[str] = []

    if action == "drop-missing":
        # Scoped drop-missing is not supported in MVP (would require row-wise merge of kept/dropped sets).
        if where_parts:
            raise ValueError("Scoped apply is not supported for drop-missing")
        pred = " and ".join([f"{quote_ident(f)} is not null" for f in fields]) or "true"
        where_sql = f"where {pred}"
        select_exprs = [quote_ident(c) for c in col_names]
    else:
        select_exprs = [quote_ident(c) for c in col_names]
        for i, c in enumerate(col_names):
            if c not in fields:
                continue
            if action == "trim":
                expr = f"trim({quote_ident(c)})"
                select_exprs[i] = f"case when {scope_sql} then {expr} else {quote_ident(c)} end as {quote_ident(c)}"
            elif action == "lowercase":
                expr = f"lower(cast({quote_ident(c)} as varchar))"
                select_exprs[i] = f"case when {scope_sql} then {expr} else {quote_ident(c)} end as {quote_ident(c)}"
            elif action == "standardize-missing":
                tok = "lower(trim(cast({col} as varchar)))".format(col=quote_ident(c))
                cond = f"{quote_ident(c)} is not null and ({tok} = '' or {tok} in ('na','n/a','null','none','nan','-','—','--','?','9999'))"
                expr = f"case when {cond} then null else {quote_ident(c)} end"
                select_exprs[i] = f"case when {scope_sql} then {expr} else {quote_ident(c)} end as {quote_ident(c)}"
            elif action in {"fill-mean", "fill-median"}:
                # MVP: scoped fill not supported yet.
                if where_parts:
                    raise ValueError("Scoped apply is not supported for this action")
                duck_t = next(t for (n, t, _) in cols if n == c).upper()
                if duck_t not in {"INTEGER", "INT", "INT4", "BIGINT", "INT8", "DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL"}:
                    raise ValueError(f"{action} only supports numeric columns: {c}")
                agg = "avg" if action == "fill-mean" else "median"
                fill_value = conn.execute(
                    f"select {agg}({quote_ident(c)}) from {quote_ident(physical)}"
                ).fetchone()[0]
                select_exprs[i] = f"coalesce({quote_ident(c)}, ?) as {quote_ident(c)}"
            else:
                raise ValueError(f"Unsupported clean action: {action}")

    params: list[Any] = []
    if action in {"fill-mean", "fill-median"}:
        # If multiple fields are selected, fill each with its own computed value.
        select_exprs = []
        for c in col_names:
            if c not in fields:
                select_exprs.append(quote_ident(c))
                continue
            duck_t = next(t for (n, t, _) in cols if n == c).upper()
            if duck_t not in {"INTEGER", "INT", "INT4", "BIGINT", "INT8", "DOUBLE", "FLOAT", "FLOAT8", "REAL", "DECIMAL"}:
                raise ValueError(f"{action} only supports numeric columns: {c}")
            agg = "avg" if action == "fill-mean" else "median"
            fill_value = conn.execute(f"select {agg}({quote_ident(c)}) from {quote_ident(physical)}").fetchone()[0]
            params.append(fill_value)
            select_exprs.append(f"coalesce({quote_ident(c)}, ?) as {quote_ident(c)}")

    conn.execute(
        f"create table {quote_ident(new_physical)} as select {', '.join(select_exprs)} from {quote_ident(physical)} {where_sql}",
        [*where_params, *params],
    )

    prev_version_row = conn.execute(
        "select id from dw_meta.table_versions where table_id = ? and is_active = true", [table_id]
    ).fetchone()
    prev_version_id = prev_version_row[0]

    new_version_id = new_id("ver")
    now = utcnow()
    conn.execute(
        """
        insert into dw_meta.table_versions (id, table_id, version, physical_name, op_log_id, created_at, is_active)
        values (?, ?, ?, ?, null, ?, false)
        """,
        [new_version_id, table_id, new_ver, new_physical, now],
    )
    _set_active_version(conn, table_id, new_version_id)
    conn.execute("update dw_meta.tables set dirty = true where id = ?", [table_id])

    op_id = new_id("op")
    table_name = conn.execute("select name from dw_meta.tables where id = ?", [table_id]).fetchone()[0]
    conn.execute(
        """
        insert into dw_meta.operation_logs
          (id, type, table_id, table_name, params_json, result_json, created_at, undoable, prev_version_id, new_version_id)
        values (?, 'clean', ?, ?, ?, ?, ?, true, ?, ?)
        """,
        [
            op_id,
            table_id,
            table_name,
            _json_dumps({"action": action, "fields": fields}),
            _json_dumps({"newVersion": new_ver}),
            now,
            prev_version_id,
            new_version_id,
        ],
    )
    conn.execute("update dw_meta.table_versions set op_log_id = ? where id = ?", [op_id, new_version_id])
    return {"operationId": op_id, "tableId": table_id, "timestamp": now}


def undo_last_clean(conn: duckdb.DuckDBPyConnection) -> dict[str, Any] | None:
    row = conn.execute(
        """
        select id, table_id, prev_version_id
        from dw_meta.operation_logs
        where type = 'clean' and undoable = true
        order by created_at desc
        limit 1
        """
    ).fetchone()
    if not row:
        return None
    op_id, table_id, prev_version_id = row
    if not prev_version_id:
        return None
    _set_active_version(conn, table_id, prev_version_id)
    conn.execute("update dw_meta.operation_logs set undoable = false where id = ?", [op_id])
    return {"undoneOperationId": op_id, "tableId": table_id}


def list_lineages(conn: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "select id, derived_table_id, source_table_ids_json, operation from dw_meta.lineage_edges order by created_at desc"
    ).fetchall()
    out: list[dict[str, Any]] = []
    for lid, derived, sources_json, op in rows:
        out.append(
            {
                "id": lid,
                "derivedTableId": derived,
                "sourceTableIds": json.loads(sources_json),
                "operation": op,
            }
        )
    return out


def compute_chart(conn: duckdb.DuckDBPyConnection, table_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    physical = _active_physical_name(conn, table_id)
    field = payload["field"]
    kind = payload["kind"]
    bins = int(payload.get("bins", 20))
    limit = int(payload.get("limit", 10))

    def vega_lite(spec: dict[str, Any]) -> dict[str, Any]:
        # Non-breaking: add a Vega-Lite spec alongside existing chart data so the frontend can render immediately.
        return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            **spec,
        }

    cols = {c[0] for c in _list_columns(conn, physical)}
    if field not in cols:
        raise ValueError("Unknown field")

    ts = utcnow()
    if kind == "histogram":
        stats = conn.execute(
            f"select min({quote_ident(field)}), max({quote_ident(field)}) from {quote_ident(physical)} where {quote_ident(field)} is not null"
        ).fetchone()
        if stats[0] is None or stats[1] is None:
            return {"kind": kind, "field": field, "data": {"bins": []}, "timestamp": ts}
        min_v, max_v = float(stats[0]), float(stats[1])
        if min_v == max_v:
            count = int(
                conn.execute(
                    f"select count(*) from {quote_ident(physical)} where {quote_ident(field)} is not null"
                ).fetchone()[0]
            )
            return {"kind": kind, "field": field, "data": {"bins": [{"x0": min_v, "x1": max_v, "count": count}]}, "timestamp": ts}
        width = (max_v - min_v) / bins
        df = conn.execute(
            f"""
            select
              floor( ({quote_ident(field)} - ?) / ? )::int as b,
              count(*) as count
            from {quote_ident(physical)}
            where {quote_ident(field)} is not null
            group by b
            order by b asc
            """,
            [min_v, width],
        ).fetchdf()
        out_bins: list[dict[str, Any]] = []
        for _, r in df.iterrows():
            b = int(r["b"])
            x0 = min_v + (b * width)
            x1 = x0 + width
            out_bins.append({"x0": x0, "x1": x1, "count": int(r["count"])})
        return {
            "kind": kind,
            "field": field,
            "data": {"bins": out_bins},
            "vegaLite": vega_lite(
                {
                    "description": f"Histogram of {field}",
                    "data": {"values": out_bins},
                    "mark": "bar",
                    "encoding": {
                        "x": {"field": "x0", "type": "quantitative", "bin": {"binned": True}},
                        "x2": {"field": "x1"},
                        "y": {"field": "count", "type": "quantitative"},
                    },
                }
            ),
            "timestamp": ts,
        }

    if kind == "bar":
        df = conn.execute(
            f"""
            select {quote_ident(field)} as value, count(*) as count
            from {quote_ident(physical)}
            where {quote_ident(field)} is not null
            group by {quote_ident(field)}
            order by count desc
            limit ?
            """,
            [limit],
        ).fetchdf()
        values = df.to_dict(orient="records")
        return {
            "kind": kind,
            "field": field,
            "data": {"values": values},
            "vegaLite": vega_lite(
                {
                    "description": f"Top categories of {field}",
                    "data": {"values": values},
                    "mark": "bar",
                    "encoding": {
                        "x": {"field": "value", "type": "nominal", "sort": "-y"},
                        "y": {"field": "count", "type": "quantitative"},
                    },
                }
            ),
            "timestamp": ts,
        }

    if kind == "line":
        value_field = payload.get("valueField")
        if value_field:
            if value_field not in cols:
                raise ValueError("Unknown valueField")
            df = conn.execute(
                f"""
                select {quote_ident(field)} as x, avg({quote_ident(value_field)}) as y
                from {quote_ident(physical)}
                where {quote_ident(field)} is not null and {quote_ident(value_field)} is not null
                group by x
                order by x asc
                """
            ).fetchdf()
        else:
            df = conn.execute(
                f"""
                select {quote_ident(field)} as x, count(*) as y
                from {quote_ident(physical)}
                where {quote_ident(field)} is not null
                group by x
                order by x asc
                """
            ).fetchdf()
        points = df.to_dict(orient="records")
        y_title = f"avg({value_field})" if value_field else "count"
        return {
            "kind": kind,
            "field": field,
            "data": {"points": points},
            "vegaLite": vega_lite(
                {
                    "description": f"Line chart by {field}",
                    "data": {"values": points},
                    "mark": {"type": "line", "point": True},
                    "encoding": {
                        "x": {"field": "x", "type": "temporal"},
                        "y": {"field": "y", "type": "quantitative", "title": y_title},
                    },
                }
            ),
            "timestamp": ts,
        }

    raise ValueError("Unsupported chart kind")


def merge_tables(conn: duckdb.DuckDBPyConnection, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    left_id = payload["leftTableId"]
    right_id = payload["rightTableId"]
    left_keys = payload["leftKeys"]
    right_keys = payload["rightKeys"]
    how = payload.get("how", "full")
    join_type = payload["joinType"]

    left_physical = _active_physical_name(conn, left_id)
    right_physical = _active_physical_name(conn, right_id)

    left_cols = [c[0] for c in _list_columns(conn, left_physical)]
    right_cols = [c[0] for c in _list_columns(conn, right_physical)]
    for k in left_keys:
        if k not in left_cols:
            raise ValueError(f"Unknown left key: {k}")
    for k in right_keys:
        if k not in right_cols:
            raise ValueError(f"Unknown right key: {k}")
    if len(left_keys) != len(right_keys):
        raise ValueError("leftKeys and rightKeys must have same length")

    join_pred = " and ".join(
        [f"l.{quote_ident(left_keys[i])} = r.{quote_ident(right_keys[i])}" for i in range(len(left_keys))]
    )
    join_sql = {"full": "full outer", "left": "left", "right": "right", "inner": "inner"}[how]

    result_table_id = new_id("table")
    result_name = payload.get("resultName") or f"merge_{left_id[:8]}_{right_id[:8]}"
    result_physical = _physical_name(result_table_id, 1)

    left_select = [f"l.{quote_ident(c)} as {quote_ident(c)}" for c in left_cols]
    right_renamed: list[str] = []
    for c in right_cols:
        out_name = c if c not in left_cols else f"right_{c}"
        right_renamed.append(f"r.{quote_ident(c)} as {quote_ident(out_name)}")

    conn.execute(
        f"""
        create table {quote_ident(result_physical)} as
        select
          {", ".join(left_select + right_renamed)},
          case
            when l.__in_left = 1 and r.__in_right = 1 then 3
            when l.__in_left = 1 and r.__in_right is null then 1
            when l.__in_left is null and r.__in_right = 1 then 2
            else null
          end as _merge
        from (select *, 1 as __in_left from {quote_ident(left_physical)}) l
        {join_sql} join (select *, 1 as __in_right from {quote_ident(right_physical)}) r
          on {join_pred}
        """
    )

    now = utcnow()
    conn.execute(
        """
        insert into dw_meta.tables (id, name, source_type, source_file_id, dirty, created_at, updated_at)
        values (?, ?, 'derived', null, false, ?, ?)
        """,
        [result_table_id, result_name, now, now],
    )
    ver_id = new_id("ver")
    conn.execute(
        """
        insert into dw_meta.table_versions (id, table_id, version, physical_name, op_log_id, created_at, is_active)
        values (?, ?, 1, ?, null, ?, true)
        """,
        [ver_id, result_table_id, result_physical, now],
    )

    lineage_edges: list[dict[str, Any]] = []
    lineage_id = new_id("lin")
    lineage_edges.append(
        {
            "id": lineage_id,
            "derivedTableId": result_table_id,
            "sourceTableIds": [left_id, right_id],
            "operation": "merge",
        }
    )
    conn.execute(
        """
        insert into dw_meta.lineage_edges (id, derived_table_id, source_table_ids_json, operation, created_at)
        values (?, ?, ?, 'merge', ?)
        """,
        [lineage_id, result_table_id, _json_dumps([left_id, right_id]), now],
    )

    rows_before_left = int(conn.execute(f"select count(*) from {quote_ident(left_physical)}").fetchone()[0])
    rows_before_right = int(conn.execute(f"select count(*) from {quote_ident(right_physical)}").fetchone()[0])
    rows_after = int(conn.execute(f"select count(*) from {quote_ident(result_physical)}").fetchone()[0])
    matched = int(conn.execute(f"select count(*) from {quote_ident(result_physical)} where _merge = 3").fetchone()[0])
    unmatched_left = int(conn.execute(f"select count(*) from {quote_ident(result_physical)} where _merge = 1").fetchone()[0])
    unmatched_right = int(conn.execute(f"select count(*) from {quote_ident(result_physical)} where _merge = 2").fetchone()[0])

    report_id = new_id("merge")
    merge_report = {
        "id": report_id,
        "leftTable": left_id,
        "rightTable": right_id,
        "resultTable": result_table_id,
        "joinType": join_type,
        "keyFields": [f"{left_keys[i]}={right_keys[i]}" for i in range(len(left_keys))],
        "rowsBefore": {"left": rows_before_left, "right": rows_before_right},
        "rowsAfter": rows_after,
        "matchedRows": matched,
        "unmatchedLeft": unmatched_left,
        "unmatchedRight": unmatched_right,
        "timestamp": now,
    }

    return get_table_meta(conn, result_table_id), merge_report, lineage_edges


def reshape_table(conn: duckdb.DuckDBPyConnection, payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    table_id = payload["tableId"]
    direction = payload["direction"]
    id_vars = payload["idVars"]
    value_vars = payload["valueVars"]
    result_table_id = new_id("table")
    result_name = payload.get("resultName") or f"reshape_{table_id[:8]}"
    result_physical = _physical_name(result_table_id, 1)

    source_physical = _active_physical_name(conn, table_id)
    df = conn.execute(f"select * from {quote_ident(source_physical)}").arrow()
    pl_df = pl.from_arrow(df)
    rows_before, cols_before = pl_df.height, pl_df.width

    if direction == "wide-to-long":
        variable_name = payload.get("variableName") or "variable"
        value_name = payload.get("valueName") or "value"
        out = pl_df.melt(
            id_vars=id_vars, value_vars=value_vars, variable_name=variable_name, value_name=value_name
        )
    else:
        pivot_columns = payload.get("pivotColumns")
        pivot_values = payload.get("pivotValues")
        if not pivot_columns or not pivot_values:
            raise ValueError("long-to-wide requires pivotColumns and pivotValues")
        out = pl_df.pivot(index=id_vars, columns=pivot_columns, values=pivot_values, aggregate_function="first")

    rows_after, cols_after = out.height, out.width

    conn.register("tmp_reshape_arrow", out.to_arrow())
    conn.execute(f"create table {quote_ident(result_physical)} as select * from tmp_reshape_arrow")
    conn.unregister("tmp_reshape_arrow")

    now = utcnow()
    conn.execute(
        """
        insert into dw_meta.tables (id, name, source_type, source_file_id, dirty, created_at, updated_at)
        values (?, ?, 'derived', null, false, ?, ?)
        """,
        [result_table_id, result_name, now, now],
    )
    ver_id = new_id("ver")
    conn.execute(
        """
        insert into dw_meta.table_versions (id, table_id, version, physical_name, op_log_id, created_at, is_active)
        values (?, ?, 1, ?, null, ?, true)
        """,
        [ver_id, result_table_id, result_physical, now],
    )

    lineage_edges: list[dict[str, Any]] = []
    lineage_id = new_id("lin")
    lineage_edges.append(
        {"id": lineage_id, "derivedTableId": result_table_id, "sourceTableIds": [table_id], "operation": "reshape"}
    )
    conn.execute(
        """
        insert into dw_meta.lineage_edges (id, derived_table_id, source_table_ids_json, operation, created_at)
        values (?, ?, ?, 'reshape', ?)
        """,
        [lineage_id, result_table_id, _json_dumps([table_id]), now],
    )

    report_id = new_id("reshape")
    report = {
        "id": report_id,
        "sourceTable": table_id,
        "resultTable": result_table_id,
        "direction": direction,
        "idVars": id_vars,
        "valueVars": value_vars,
        "rowsBefore": rows_before,
        "rowsAfter": rows_after,
        "columnsBefore": cols_before,
        "columnsAfter": cols_after,
        "timestamp": now,
    }

    return get_table_meta(conn, result_table_id), report, lineage_edges


def export_table_csv(conn: duckdb.DuckDBPyConnection, table_id: str, out_path: Path) -> None:
    physical = _active_physical_name(conn, table_id)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    conn.execute(
        f"copy (select * from {quote_ident(physical)}) to ? (header, delimiter ',')",
        [str(out_path)],
    )


def export_table_dta(conn: duckdb.DuckDBPyConnection, table_id: str, out_path: Path) -> dict[str, str]:
    physical = _active_physical_name(conn, table_id)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df = conn.execute(f"select * from {quote_ident(physical)}").fetchdf()

    original = list(df.columns)
    cleaned = [sanitize_stata_varname(c) for c in original]
    cleaned = dedupe_names(cleaned)
    mapping = {original[i]: cleaned[i] for i in range(len(original))}
    df = df.rename(columns=mapping)

    pyreadstat.write_dta(df, str(out_path))
    return mapping


def get_history(conn: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        select id, type, table_id, table_name, params_json, created_at, undoable
        from dw_meta.operation_logs
        order by created_at desc
        limit 200
        """
    ).fetchall()
    out: list[dict[str, Any]] = []
    for op_id, typ, table_id, table_name, params_json, created_at, undoable in rows:
        out.append(
            {
                "id": op_id,
                "type": typ,
                "tableId": table_id,
                "tableName": table_name,
                "params": json.loads(params_json),
                "timestamp": created_at,
                "undoable": bool(undoable),
            }
        )
    return out


def preview_clean(
    conn: duckdb.DuckDBPyConnection,
    table_id: str,
    action: str,
    fields: list[str],
    filters: list[dict[str, Any]] | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """Return a best-effort preview of a clean action.

    MVP: currently supports standardize-missing only.
    """
    physical = _active_physical_name(conn, table_id)
    cols = _list_columns(conn, physical)
    allowed = {c[0] for c in cols}
    for f in fields:
        if f not in allowed:
            raise ValueError(f"Unknown field: {f}")

    if action not in {"standardize-missing", "trim", "lowercase"}:
        raise ValueError("Preview not supported for this action yet")

    # Use row_number as a stable-ish synthetic row id for preview purposes.
    base_query = f"select row_number() over () as __rid, * from {quote_ident(physical)}"

    # Optional scope filters
    filters = filters or []
    scope_parts: list[str] = []
    scope_params: list[Any] = []
    if filters:
        for f in filters:
            field = f["field"]
            if field not in allowed:
                raise ValueError(f"Unknown field: {field}")
            op = f["op"]
            if op == "isnull":
                scope_parts.append(f"{quote_ident(field)} is null")
            elif op == "notnull":
                scope_parts.append(f"{quote_ident(field)} is not null")
            elif op == "contains":
                scope_parts.append(f"{quote_ident(field)} ilike ?")
                scope_params.append(f"%{f.get('value','')}%")
            elif op == "eq":
                scope_parts.append(f"{quote_ident(field)} = ?")
                scope_params.append(f.get("value"))
            elif op == "neq":
                scope_parts.append(f"{quote_ident(field)} != ?")
                scope_params.append(f.get("value"))
            else:
                raise ValueError(f"Unsupported filter op for preview: {op}")

    scope_sql = f"({' and '.join(scope_parts)})" if scope_parts else "true"

    def _cond_sql(field: str) -> str:
        ident = quote_ident(field)
        if action == "standardize-missing":
            tok = f"lower(trim(cast({ident} as varchar)))"
            return f"{ident} is not null and ({tok} = '' or {tok} in ('na','n/a','null','none','nan','-','—','--','?','9999'))"
        if action == "trim":
            tok = f"trim(cast({ident} as varchar))"
            return f"{ident} is not null and cast({ident} as varchar) != {tok}"
        if action == "lowercase":
            tok = f"lower(cast({ident} as varchar))"
            return f"{ident} is not null and cast({ident} as varchar) != {tok}"
        return "false"

    # per-field affected cell count
    per_field: list[dict[str, Any]] = []
    total_cells = 0
    for f in fields:
        cond = _cond_sql(f)
        cnt = int(conn.execute(f"select count(*) from ({base_query}) t where {scope_sql} and {cond}", scope_params).fetchone()[0] or 0)
        total_cells += cnt
        per_field.append({"field": f, "affectedCells": cnt})

    # affected rows (any selected field)
    if fields:
        any_cond = " or ".join([f"({_cond_sql(f)})" for f in fields])
        affected_rows = int(conn.execute(f"select count(*) from ({base_query}) t where {scope_sql} and ({any_cond})", scope_params).fetchone()[0] or 0)
    else:
        affected_rows = 0

    # sample rows
    samples: list[dict[str, Any]] = []
    if fields and limit > 0 and affected_rows > 0:
        any_cond = " or ".join([f"({_cond_sql(f)})" for f in fields])
        df = conn.execute(
            f"select * from ({base_query}) t where {scope_sql} and ({any_cond}) limit ?",
            [*scope_params, int(limit)],
        ).fetchdf()
        raw = df.to_dict(orient="records")
        # Normalize pandas/numpy types (reuse helper logic)
        try:
            import pandas as _pd  # type: ignore
            import numpy as _np  # type: ignore

            def _norm(v: Any) -> Any:
                if v is None:
                    return None
                if v is _pd.NaT:
                    return None
                if isinstance(v, _pd.Timestamp):
                    return v.to_pydatetime().isoformat()
                if isinstance(v, _np.generic):
                    vv = v.item()
                    if isinstance(vv, float) and _pd.isna(vv):
                        return None
                    return vv
                if isinstance(v, float) and _pd.isna(v):
                    return None
                return v

            raw = [{k: _norm(v) for k, v in r.items()} for r in raw]
        except Exception:
            pass

        for r in raw:
            item = {"__rid": r.get("__rid")}
            for f in fields:
                before = r.get(f)
                if before is None:
                    after = None
                else:
                    if action == "standardize-missing":
                        s = str(before).strip().lower()
                        after = None if (s == "" or s in {"na","n/a","null","none","nan","-","—","--","?","9999"}) else before
                    elif action == "trim":
                        after = str(before).strip()
                    elif action == "lowercase":
                        after = str(before).lower()
                    else:
                        after = before
                item[f] = {"before": before, "after": after}
            samples.append(item)

    return {
        "tableId": table_id,
        "action": action,
        "fields": fields,
        "affectedRows": affected_rows,
        "affectedCells": total_cells,
        "perField": per_field,
        "samples": samples,
    }
