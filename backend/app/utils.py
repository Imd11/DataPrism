from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from uuid import uuid4


_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_ident(name: str) -> str:
    if not _IDENT_RE.match(name):
        raise ValueError(f"Invalid identifier: {name!r}")
    return name


def quote_ident(name: str) -> str:
    # Quote SQL identifiers safely for DuckDB.
    # DuckDB supports double-quoted identifiers with embedded quotes escaped by doubling.
    if "\x00" in name:
        raise ValueError("Identifier contains NUL byte")
    escaped = name.replace('"', '""')
    return f"\"{escaped}\""


def sanitize_stata_varname(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", name.strip())
    if not cleaned:
        cleaned = "v"
    if not re.match(r"^[A-Za-z_]", cleaned):
        cleaned = f"v_{cleaned}"
    return cleaned[:32]


def dedupe_names(names: Iterable[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for raw in names:
        base = raw
        if base not in seen:
            seen[base] = 0
            out.append(base)
            continue
        seen[base] += 1
        suffix = seen[base]
        candidate = f"{base}_{suffix}"
        while candidate in seen:
            suffix += 1
            candidate = f"{base}_{suffix}"
        seen[candidate] = 0
        out.append(candidate)
    return out
