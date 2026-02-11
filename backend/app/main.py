from __future__ import annotations

import os
import traceback
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .settings import load_settings
from .routers.projects import router as projects_router


settings = load_settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Data Weaver API", version="0.1.0")
debug = os.getenv("DATA_WEAVER_DEBUG", "").lower() in {"1", "true", "yes", "on"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/api")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_id = uuid4().hex[:10]
    print(f"[data-weaver] errorId={error_id} path={request.url.path}")
    traceback.print_exc()
    payload: dict[str, str] = {"detail": "Internal Server Error", "errorId": error_id}
    if debug:
        payload["exception"] = repr(exc)
    return JSONResponse(status_code=500, content=payload)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
