from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import duckdb


def _init_schema(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("create schema if not exists dw_meta;")
    conn.execute(
        """
        create table if not exists dw_meta.files (
          id varchar primary key,
          name varchar not null,
          type varchar not null,
          size bigint not null,
          stored_path varchar not null,
          created_at timestamptz not null,
          updated_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.tables (
          id varchar primary key,
          name varchar not null,
          source_type varchar not null,
          source_file_id varchar,
          dirty boolean not null,
          created_at timestamptz not null,
          updated_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.table_versions (
          id varchar primary key,
          table_id varchar not null,
          version integer not null,
          physical_name varchar not null,
          op_log_id varchar,
          created_at timestamptz not null,
          is_active boolean not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.primary_keys (
          table_id varchar primary key,
          fields_json varchar not null,
          created_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.primary_keys_inferred (
          table_id varchar primary key,
          fields_json varchar not null,
          created_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.relation_edges (
          id varchar primary key,
          fk_table_id varchar not null,
          fk_fields_json varchar not null,
          pk_table_id varchar not null,
          pk_fields_json varchar not null,
          cardinality varchar not null,
          created_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.relation_edges_inferred (
          id varchar primary key,
          fk_table_id varchar not null,
          fk_fields_json varchar not null,
          pk_table_id varchar not null,
          pk_fields_json varchar not null,
          cardinality varchar not null,
          coverage double not null,
          created_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.column_profiles (
          table_id varchar not null,
          column_name varchar not null,
          row_count bigint not null,
          missing_count bigint not null,
          distinct_count bigint not null,
          is_unique boolean not null,
          is_identity boolean not null,
          inferred_nullable boolean not null,
          updated_at timestamptz not null,
          primary key (table_id, column_name)
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.lineage_edges (
          id varchar primary key,
          derived_table_id varchar not null,
          source_table_ids_json varchar not null,
          operation varchar not null,
          created_at timestamptz not null
        );
        """
    )
    conn.execute(
        """
        create table if not exists dw_meta.operation_logs (
          id varchar primary key,
          type varchar not null,
          table_id varchar not null,
          table_name varchar not null,
          params_json varchar not null,
          result_json varchar,
          created_at timestamptz not null,
          undoable boolean not null,
          prev_version_id varchar,
          new_version_id varchar
        );
        """
    )


@contextmanager
def connect(db_path: Path) -> Iterator[duckdb.DuckDBPyConnection]:
    conn = duckdb.connect(str(db_path))
    try:
        _init_schema(conn)
        yield conn
    finally:
        conn.close()
