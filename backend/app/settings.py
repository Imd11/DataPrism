from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    allowed_origins: list[str]


def load_settings() -> Settings:
    default_data_dir = (Path(__file__).resolve().parents[2] / ".data-weaver").resolve()
    raw_data_dir = os.getenv("DATA_WEAVER_DATA_DIR", "")
    data_dir = Path(raw_data_dir).expanduser().resolve() if raw_data_dir else default_data_dir
    raw_origins = os.getenv("DATA_WEAVER_ALLOWED_ORIGINS", "http://localhost:8080,http://127.0.0.1:8080")
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    return Settings(data_dir=data_dir, allowed_origins=allowed_origins)
