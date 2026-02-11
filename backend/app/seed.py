from __future__ import annotations

import shutil
from pathlib import Path

from .db import connect
from .services import create_relation, import_csv, merge_tables, refresh_inference, reshape_table, set_primary_key
from .settings import Settings
from .storage import (
  project_db_path,
  project_exports_dir,
  project_files_dir,
  write_project_manifest,
  list_project_manifests,
)
from .utils import ensure_dir, new_id, utcnow


def ensure_demo_project(settings: Settings) -> str:
  existing = list_project_manifests(settings)
  if existing:
    return str(existing[0]["id"])

  project_id = new_id("proj")
  now = utcnow()
  manifest = {
    "id": project_id,
    "name": "Demo Project (E-Commerce + Sales)",
    "createdAt": now.isoformat(),
    "updatedAt": now.isoformat(),
    "tags": ["demo", "ecommerce", "sales"],
  }
  write_project_manifest(settings, project_id, manifest)
  ensure_dir(project_files_dir(settings, project_id))
  ensure_dir(project_exports_dir(settings, project_id))

  db_path = project_db_path(settings, project_id)
  ensure_dir(db_path.parent)

  seeds_dir = Path(__file__).resolve().parents[1] / "seeds"
  if not seeds_dir.exists():
    raise RuntimeError("Seed files missing")

  seed_files = [
    "customers.csv",
    "categories.csv",
    "products.csv",
    "orders.csv",
    "order_items.csv",
    "monthly_sales_wide.csv",
  ]

  table_ids: dict[str, str] = {}

  with connect(db_path) as conn:
    for seed_name in seed_files:
      src = seeds_dir / seed_name
      if not src.exists():
        raise RuntimeError(f"Missing seed file: {seed_name}")
      file_id = new_id("file")
      stored = project_files_dir(settings, project_id) / f"{file_id}_{seed_name}"
      shutil.copyfile(src, stored)
      size = stored.stat().st_size
      now2 = utcnow()
      conn.execute(
        """
        insert into dw_meta.files (id, name, type, size, stored_path, created_at, updated_at)
        values (?, ?, 'csv', ?, ?, ?, ?)
        """,
        [file_id, seed_name, size, str(stored), now2, now2],
      )

      table_id = new_id("table")
      table_name = Path(seed_name).stem
      import_csv(conn, file_id, table_id, table_name, stored)
      table_ids[table_name] = table_id

    # Primary keys
    set_primary_key(conn, table_ids["customers"], ["customer_id"])
    set_primary_key(conn, table_ids["categories"], ["category_id"])
    set_primary_key(conn, table_ids["products"], ["product_id"])
    set_primary_key(conn, table_ids["orders"], ["order_id"])
    set_primary_key(conn, table_ids["order_items"], ["item_id"])

    # Relations (FK -> PK)
    create_relation(
      conn,
      {
        "fkTableId": table_ids["products"],
        "fkFields": ["category_id"],
        "pkTableId": table_ids["categories"],
        "pkFields": ["category_id"],
        "cardinality": "m:1",
      },
    )
    create_relation(
      conn,
      {
        "fkTableId": table_ids["orders"],
        "fkFields": ["customer_id"],
        "pkTableId": table_ids["customers"],
        "pkFields": ["customer_id"],
        "cardinality": "m:1",
      },
    )
    create_relation(
      conn,
      {
        "fkTableId": table_ids["order_items"],
        "fkFields": ["order_id"],
        "pkTableId": table_ids["orders"],
        "pkFields": ["order_id"],
        "cardinality": "m:1",
      },
    )
    create_relation(
      conn,
      {
        "fkTableId": table_ids["order_items"],
        "fkFields": ["product_id"],
        "pkTableId": table_ids["products"],
        "pkFields": ["product_id"],
        "cardinality": "m:1",
      },
    )

    # Create derived tables for lineage demo
    merge_tables(
      conn,
      {
        "leftTableId": table_ids["orders"],
        "rightTableId": table_ids["customers"],
        "leftKeys": ["customer_id"],
        "rightKeys": ["customer_id"],
        "joinType": "m:1",
        "how": "full",
        "resultName": "orders_enriched",
      },
    )

    reshape_table(
      conn,
      {
        "tableId": table_ids["monthly_sales_wide"],
        "direction": "wide-to-long",
        "idVars": ["id", "year"],
        "valueVars": ["m01", "m02", "m03", "m04", "m05", "m06"],
        "variableName": "month",
        "valueName": "sales",
        "resultName": "monthly_sales_long",
      },
    )

    # Ensure nullable/unique/identity + inferred relations are ready immediately.
    refresh_inference(conn)

  return project_id
