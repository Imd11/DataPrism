import type {
  DataFile,
  DataTable,
  LineageEdge,
  OperationLog,
  Project,
  QualityReport,
  RelationEdge,
  RowData,
  SummaryResult,
} from "@/types/data";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  const body = await parseJsonSafely(res);
  if (!res.ok) {
    let message =
      typeof body === "object" && body && "detail" in (body as any)
        ? String((body as any).detail)
        : `Request failed: ${res.status}`;
    if (typeof body === "object" && body && "errorId" in (body as any)) {
      message = `${message} (errorId: ${String((body as any).errorId)})`;
    }
    if (typeof body === "string") {
      if (body.includes("ECONNREFUSED") || body.includes("socket hang up") || body.includes("connect ETIMEDOUT")) {
        message = "Backend is not reachable. Start API on :8000 (uvicorn or docker compose).";
      }
      if (body.includes("Error occurred while proxying request")) {
        message = "Backend proxy failed. Start API on :8000 (uvicorn or docker compose).";
      }
    }
    if (res.status === 500 && path.startsWith("/api") && message === `Request failed: ${res.status}`) {
      message = "API returned 500. If you are using Vite proxy, ensure backend is running on http://127.0.0.1:8000 (and check uvicorn logs).";
    }
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

function parseProject(p: any): Project {
  return {
    ...p,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
  };
}

function parseFile(f: any, projectId: string): DataFile {
  return {
    ...f,
    projectId,
    updatedAt: new Date(f.updatedAt),
  };
}

function parseOperation(op: any): OperationLog {
  return {
    ...op,
    timestamp: new Date(op.timestamp),
  };
}

function parseSummary(s: any): SummaryResult {
  return {
    ...s,
    timestamp: new Date(s.timestamp),
  };
}

function parseQuality(q: any): QualityReport {
  return {
    ...q,
    timestamp: new Date(q.timestamp),
  };
}

export const api = {
  async health(): Promise<{ status: string }> {
    return requestJson("/api/health");
  },

  async listProjects(): Promise<Project[]> {
    const raw = await requestJson<any[]>("/api/projects");
    return raw.map(parseProject);
  },

  async createProject(input: { name: string; tags?: string[] }): Promise<Project> {
    const raw = await requestJson<any>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, tags: input.tags ?? [] }),
    });
    return parseProject(raw);
  },

  async seedDemo(): Promise<{ projectId: string }> {
    return requestJson("/api/demo/seed", { method: "POST" });
  },

  async listFiles(projectId: string): Promise<DataFile[]> {
    const raw = await requestJson<any[]>(`/api/projects/${projectId}/files`);
    return raw.map((f) => parseFile(f, projectId));
  },

  async importFile(projectId: string, file: File): Promise<{ fileId: string; table: DataTable }> {
    const fd = new FormData();
    fd.append("file", file);
    return requestJson(`/api/projects/${projectId}/files/import`, {
      method: "POST",
      body: fd,
    });
  },

  async listTables(projectId: string): Promise<DataTable[]> {
    return requestJson(`/api/projects/${projectId}/tables`);
  },

  async getCanvas(projectId: string): Promise<{ tables: DataTable[]; relations: RelationEdge[]; lineages: LineageEdge[] }> {
    return requestJson(`/api/projects/${projectId}/canvas`);
  },

  async queryRows(projectId: string, tableId: string, input: { offset: number; limit: number; sort?: { field: string; direction: "asc" | "desc" }[] }): Promise<{ rows: RowData[]; totalRows: number }> {
    return requestJson(`/api/projects/${projectId}/tables/${tableId}/rows:query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset: input.offset,
        limit: input.limit,
        filters: [],
        sort: input.sort ?? [],
      }),
    });
  },

  async summary(projectId: string, tableId: string): Promise<SummaryResult> {
    const raw = await requestJson<any>(`/api/projects/${projectId}/tables/${tableId}/summary`, {
      method: "POST",
    });
    return parseSummary(raw);
  },

  async quality(projectId: string, tableId: string): Promise<QualityReport> {
    const raw = await requestJson<any>(`/api/projects/${projectId}/tables/${tableId}/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: null }),
    });
    return parseQuality(raw);
  },

  async history(projectId: string): Promise<OperationLog[]> {
    const raw = await requestJson<any[]>(`/api/projects/${projectId}/history`);
    return raw.map(parseOperation);
  },

  async undo(projectId: string): Promise<{ ok: boolean }> {
    return requestJson(`/api/projects/${projectId}/history/undo`, { method: "POST" });
  },

  async clean(projectId: string, tableId: string, input: { action: string; fields: string[] }): Promise<{ operationId: string; tableId: string; timestamp: string }> {
    return requestJson(`/api/projects/${projectId}/tables/${tableId}/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },

  async exportTable(projectId: string, tableId: string, format: "csv" | "dta"): Promise<{ downloadUrl: string }> {
    return requestJson(`/api/projects/${projectId}/tables/${tableId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
  },

  async charts(projectId: string, tableId: string, input: { kind: "histogram" | "bar" | "line"; field: string; bins?: number; limit?: number; valueField?: string | null }): Promise<any> {
    return requestJson(`/api/projects/${projectId}/tables/${tableId}/charts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: input.kind,
        field: input.field,
        bins: input.bins ?? 20,
        limit: input.limit ?? 10,
        valueField: input.valueField ?? null,
      }),
    });
  },
};

export type { ApiError };
