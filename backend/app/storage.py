from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .settings import Settings
from .utils import ensure_dir, utcnow


def projects_root(settings: Settings) -> Path:
    return settings.data_dir / "projects"


def project_dir(settings: Settings, project_id: str) -> Path:
    return projects_root(settings) / project_id


def project_db_path(settings: Settings, project_id: str) -> Path:
    return project_dir(settings, project_id) / "warehouse.duckdb"


def project_files_dir(settings: Settings, project_id: str) -> Path:
    return project_dir(settings, project_id) / "files"


def project_exports_dir(settings: Settings, project_id: str) -> Path:
    return project_dir(settings, project_id) / "exports"


def project_manifest_path(settings: Settings, project_id: str) -> Path:
    return project_dir(settings, project_id) / "project.json"


def write_project_manifest(settings: Settings, project_id: str, payload: dict[str, Any]) -> None:
    ensure_dir(project_dir(settings, project_id))
    path = project_manifest_path(settings, project_id)
    payload = {**payload, "updatedAt": utcnow().isoformat()}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_project_manifest(settings: Settings, project_id: str) -> dict[str, Any] | None:
    path = project_manifest_path(settings, project_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_project_manifests(settings: Settings) -> list[dict[str, Any]]:
    root = projects_root(settings)
    if not root.exists():
        return []
    manifests: list[dict[str, Any]] = []
    for p in root.iterdir():
        if not p.is_dir():
            continue
        manifest = read_project_manifest(settings, p.name)
        if manifest:
            manifests.append(manifest)
    manifests.sort(key=lambda m: m.get("updatedAt", ""), reverse=True)
    return manifests
