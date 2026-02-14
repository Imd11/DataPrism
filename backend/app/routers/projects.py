from __future__ import annotations

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..db import connect
from ..schemas import (
  ChartIn,
  ChartOut,
  CleanIn,
  CleanOut,
  CleanPreviewIn,
  CleanPreviewOut,
  CreateRelationIn,
  DataFileOut,
  DataTableOut,
  ExportIn,
  ExportOut,
  LineageEdgeOut,
  MergeIn,
  MergeReportOut,
  OperationLogOut,
  ProjectCreate,
  ProjectOut,
  QualityReportIn,
  QualityReportOut,
  RelationEdgeOut,
  RelationReportOut,
  ReshapeIn,
  ReshapeReportOut,
  RowsQueryIn,
  RowsQueryOut,
  SetPrimaryKeyIn,
  SummaryResultOut,
)
from ..settings import load_settings
from ..seed import ensure_demo_project
from ..storage import (
  list_project_manifests,
  project_db_path,
  project_exports_dir,
  project_files_dir,
  project_manifest_path,
  write_project_manifest,
)
from ..utils import ensure_dir, new_id, utcnow
from ..services import (
  clean_drop_missing,
  clean_table,
  compute_chart,
  compute_quality,
  compute_summary,
  create_relation,
  export_table_csv,
  export_table_dta,
  get_history,
  get_table_meta,
  import_csv,
  import_xlsx,
  list_files,
  list_lineages,
  list_relations,
  list_tables,
  query_rows,
  relation_report,
  refresh_column_profiles,
  refresh_inferred_relations,
  reshape_table,
  set_primary_key,
  merge_tables,
  undo_last_clean,
  preview_clean,
)


router = APIRouter()
settings = load_settings()


def _ensure_project_exists(project_id: str) -> Path:
  manifest = project_manifest_path(settings, project_id)
  if not manifest.exists():
    raise HTTPException(status_code=404, detail="Project not found")
  ensure_dir(project_files_dir(settings, project_id))
  ensure_dir(project_exports_dir(settings, project_id))
  return project_db_path(settings, project_id)


@router.get("/projects", response_model=list[ProjectOut])
def list_projects() -> list[dict]:
  return list_project_manifests(settings)


@router.post("/projects", response_model=ProjectOut)
def create_project(body: ProjectCreate) -> dict:
  project_id = new_id("proj")
  now = utcnow()
  manifest = {
    "id": project_id,
    "name": body.name,
    "createdAt": now.isoformat(),
    "updatedAt": now.isoformat(),
    "tags": body.tags,
  }
  write_project_manifest(settings, project_id, manifest)
  ensure_dir(project_files_dir(settings, project_id))
  ensure_dir(project_exports_dir(settings, project_id))
  db_path = project_db_path(settings, project_id)
  ensure_dir(db_path.parent)
  with connect(db_path):
    pass
  return manifest


@router.post("/demo/seed")
def seed_demo() -> dict:
  project_id = ensure_demo_project(settings)
  return {"projectId": project_id}


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str) -> dict:
  manifest = project_manifest_path(settings, project_id)
  if not manifest.exists():
    raise HTTPException(status_code=404, detail="Project not found")
  return json.loads(manifest.read_text(encoding="utf-8"))


@router.delete("/projects/{project_id}")
def delete_project(project_id: str) -> dict:
  manifest = project_manifest_path(settings, project_id)
  if not manifest.exists():
    raise HTTPException(status_code=404, detail="Project not found")
  from ..storage import project_dir
  proj_dir = project_dir(settings, project_id)
  shutil.rmtree(proj_dir, ignore_errors=True)
  return {"ok": True}


@router.get("/projects/{project_id}/files", response_model=list[DataFileOut])
def get_files(project_id: str) -> list[dict]:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    files = list_files(conn)
  for f in files:
    f["projectId"] = project_id
  return files


@router.post("/projects/{project_id}/files/import", response_model=dict)
async def import_file(project_id: str, file: UploadFile = File(...)) -> dict:
  db_path = _ensure_project_exists(project_id)

  filename = Path(file.filename or "upload").name
  ext = filename.lower().split(".")[-1] if "." in filename else ""
  if ext not in {"csv", "xlsx", "xls"}:
    raise HTTPException(status_code=400, detail="Unsupported file type (csv/xlsx/xls)")

  file_id = new_id("file")
  stored = project_files_dir(settings, project_id) / f"{file_id}_{filename}"
  ensure_dir(stored.parent)
  content = await file.read()
  stored.write_bytes(content)

  table_id = new_id("table")
  table_name = Path(filename).stem

  with connect(db_path) as conn:
    now = utcnow()
    conn.execute(
      """
      insert into dw_meta.files (id, name, type, size, stored_path, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)
      """,
      [file_id, filename, ext, len(content), str(stored), now, now],
    )
    if ext == "csv":
      import_csv(conn, file_id, table_id, table_name, stored)
    else:
      import_xlsx(conn, file_id, table_id, table_name, stored)

    # Facts-based metadata (nullable/unique/identity + inferred relations) from actual data.
    refresh_column_profiles(conn, table_id)
    refresh_inferred_relations(conn)

    table = get_table_meta(conn, table_id)

  return {"fileId": file_id, "table": table}


@router.get("/projects/{project_id}/tables", response_model=list[DataTableOut])
def get_tables(project_id: str) -> list[dict]:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    return list_tables(conn)


@router.get("/projects/{project_id}/lineages", response_model=list[LineageEdgeOut])
def get_lineages(project_id: str) -> list[dict]:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    return list_lineages(conn)


@router.get("/projects/{project_id}/canvas")
def get_canvas(project_id: str) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    # Keep canvas metadata fresh: infer relations from actual data values.
    refresh_inferred_relations(conn)
    return {
      "tables": list_tables(conn),
      "relations": list_relations(conn),
      "lineages": list_lineages(conn),
    }


@router.get("/projects/{project_id}/tables/{table_id}", response_model=DataTableOut)
def get_table(project_id: str, table_id: str) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return get_table_meta(conn, table_id)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")


@router.post("/projects/{project_id}/tables/{table_id}/rows:query", response_model=RowsQueryOut)
def rows_query(project_id: str, table_id: str, body: RowsQueryIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      rows, total = query_rows(
        conn,
        table_id,
        offset=body.offset,
        limit=body.limit,
        filters=[f.model_dump() for f in body.filters],
        sort=[s.model_dump() for s in body.sort],
      )
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))
  return {"rows": rows, "totalRows": total}


@router.post("/projects/{project_id}/tables/{table_id}/summary", response_model=SummaryResultOut)
def table_summary(project_id: str, table_id: str) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return compute_summary(conn, table_id)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")


@router.post("/projects/{project_id}/tables/{table_id}/charts", response_model=ChartOut)
def table_charts(project_id: str, table_id: str, body: ChartIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return compute_chart(conn, table_id, body.model_dump())
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/tables/{table_id}/quality", response_model=QualityReportOut)
def table_quality(project_id: str, table_id: str, body: QualityReportIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return compute_quality(conn, table_id, keys=body.keys)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}/tables/{table_id}/pk")
def set_pk(project_id: str, table_id: str, body: SetPrimaryKeyIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      set_primary_key(conn, table_id, body.fields)
      refresh_inferred_relations(conn)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))
  return {"ok": True}


@router.get("/projects/{project_id}/relations", response_model=list[RelationEdgeOut])
def relations_list(project_id: str) -> list[dict]:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    return list_relations(conn)


@router.post("/projects/{project_id}/relations", response_model=RelationEdgeOut)
def relations_create(project_id: str, body: CreateRelationIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return create_relation(conn, body.model_dump())
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/relations/{relation_id}/report", response_model=RelationReportOut)
def relations_report(project_id: str, relation_id: str) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return relation_report(conn, relation_id)
    except KeyError:
      raise HTTPException(status_code=404, detail="Relation not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/merge", response_model=dict)
def merge(project_id: str, body: MergeIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      table, report, lineage = merge_tables(conn, body.model_dump())
      refresh_column_profiles(conn, table["id"])
      refresh_inferred_relations(conn)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))
  return {"table": table, "mergeReport": report, "lineageEdges": lineage}


@router.post("/projects/{project_id}/reshape", response_model=dict)
def reshape(project_id: str, body: ReshapeIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      table, report, lineage = reshape_table(conn, body.model_dump())
      refresh_column_profiles(conn, table["id"])
      refresh_inferred_relations(conn)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))
  return {"table": table, "reshapeReport": report, "lineageEdges": lineage}


@router.post("/projects/{project_id}/tables/{table_id}/clean:drop-missing")
def clean_drop_missing_route(project_id: str, table_id: str, body: SetPrimaryKeyIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      res = clean_drop_missing(conn, table_id, body.fields)
      refresh_column_profiles(conn, table_id)
      refresh_inferred_relations(conn)
      return res
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/tables/{table_id}/clean:preview", response_model=CleanPreviewOut)
def clean_preview_route(project_id: str, table_id: str, body: CleanPreviewIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      return preview_clean(conn, table_id, action=body.action, fields=body.fields, filters=[f.model_dump() for f in body.filters], limit=body.limit)
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/tables/{table_id}/clean", response_model=CleanOut)
def clean_route(project_id: str, table_id: str, body: CleanIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    try:
      res = clean_table(conn, table_id, action=body.action, fields=body.fields, filters=[f.model_dump() for f in body.filters])
      refresh_column_profiles(conn, table_id)
      refresh_inferred_relations(conn)
      return res
    except KeyError:
      raise HTTPException(status_code=404, detail="Table not found")
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/history", response_model=list[OperationLogOut])
def history(project_id: str) -> list[dict]:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    return get_history(conn)


@router.post("/projects/{project_id}/history/undo")
def undo(project_id: str) -> dict:
  db_path = _ensure_project_exists(project_id)
  with connect(db_path) as conn:
    res = undo_last_clean(conn)
    if res and res.get("tableId"):
      refresh_column_profiles(conn, res["tableId"])
      refresh_inferred_relations(conn)
  if not res:
    return {"ok": False, "message": "Nothing to undo"}
  return {"ok": True, **res}


@router.post("/projects/{project_id}/tables/{table_id}/export", response_model=ExportOut)
def export(project_id: str, table_id: str, body: ExportIn) -> dict:
  db_path = _ensure_project_exists(project_id)
  fmt = body.format
  ts = utcnow()
  out_dir = project_exports_dir(settings, project_id)
  ensure_dir(out_dir)
  filename = f"{table_id}_{ts.strftime('%Y%m%dT%H%M%SZ')}.{fmt}"
  out_path = out_dir / filename

  with connect(db_path) as conn:
    if fmt == "csv":
      export_table_csv(conn, table_id, out_path)
    else:
      export_table_dta(conn, table_id, out_path)

  return {
    "format": fmt,
    "filename": filename,
    "downloadUrl": f"/api/projects/{project_id}/exports/{filename}",
    "timestamp": ts,
  }


@router.get("/projects/{project_id}/exports/{filename}")
def download_export(project_id: str, filename: str) -> FileResponse:
  _ensure_project_exists(project_id)
  path = project_exports_dir(settings, project_id) / Path(filename).name
  if not path.exists():
    raise HTTPException(status_code=404, detail="Not found")
  return FileResponse(path)
