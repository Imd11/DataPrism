import { create } from "zustand";
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
import { api } from "@/lib/api";

type ResultTab = "summary" | "charts" | "quality" | "merge" | "reshape" | "history";

type SortSpec = { field: string; direction: "asc" | "desc" };

interface TableDataState {
  rows: RowData[];
  totalRows: number;
  offset: number;
  limit: number;
  sort: SortSpec[];
  loading: boolean;
  error: string | null;
}

interface AppState {
  // Global
  bootstrapped: boolean;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;

  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Project state
  projects: Project[];
  currentProjectId: string | null;
  setCurrentProject: (projectId: string) => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  createDemoIfEmpty: () => Promise<void>;

  // Files state
  files: DataFile[];
  importDataset: (file: File) => Promise<void>;
  importDatasetToProject: (projectId: string, file: File) => Promise<void>;
  importDatasetAsNewProject: (file: File) => Promise<void>;

  // Tables state
  tables: DataTable[];
  openTableIds: string[];
  activeTableId: string | null;
  openTable: (tableId: string) => Promise<void>;
  closeTable: (tableId: string) => void;
  setActiveTable: (tableId: string) => void;

  tableData: Record<string, TableDataState | undefined>;
  fetchTableRows: (tableId: string, opts?: Partial<Pick<TableDataState, "offset" | "limit" | "sort">>) => Promise<void>;

  // Relations & Lineage
  relations: RelationEdge[];
  lineages: LineageEdge[];
  selectedRelationId: string | null;
  setSelectedRelation: (relationId: string | null) => void;

  // Canvas state
  selectedNodeId: string | null;
  setSelectedNode: (nodeId: string | null) => void;

  // Canvas visibility
  hiddenCanvasTableIds: string[];
  removeFromCanvas: (tableId: string) => void;
  addToCanvas: (tableId: string) => void;

  // Results state
  activeResultTab: ResultTab;
  setActiveResultTab: (tab: ResultTab) => void;

  // Operation history
  operationHistory: OperationLog[];
  refreshHistory: () => Promise<void>;
  undoLastOperation: () => Promise<void>;

  // Results caches
  summaryByTableId: Record<string, SummaryResult | undefined>;
  qualityByTableId: Record<string, QualityReport | undefined>;
  chartsByTableId: Record<string, any | undefined>;
  chartsLoadingByTableId: Record<string, boolean | undefined>;
  chartsErrorByTableId: Record<string, string | undefined>;
  fetchSummary: (tableId: string) => Promise<void>;
  fetchQuality: (tableId: string) => Promise<void>;
  fetchCharts: (tableId: string, opts?: { kind?: "histogram" | "bar" | "line"; field?: string; valueField?: string | null }) => Promise<void>;

  // Actions
  cleanColumns: (tableId: string, action: string, columns: string[]) => Promise<void>;
  exportActiveTable: (format: "csv" | "dta") => Promise<void>;
  mergeTables: (input: { leftTableId: string; rightTableId: string; leftKeys: string[]; rightKeys: string[]; joinType: "1:1" | "1:m" | "m:1"; how?: "full" | "left" | "right" | "inner"; resultName?: string }) => Promise<any>;
  reshapeTable: (input: { tableId: string; direction: "wide-to-long" | "long-to-wide"; idVars: string[]; valueVars: string[]; variableName?: string; valueName?: string; pivotColumns?: string; pivotValues?: string; resultName?: string }) => Promise<any>;
}

async function loadProjectData(projectId: string, set: any) {
  const [files, canvas, history] = await Promise.all([
    api.listFiles(projectId),
    api.getCanvas(projectId),
    api.history(projectId),
  ]);
  set({
    files,
    tables: canvas.tables,
    relations: canvas.relations,
    lineages: canvas.lineages,
    operationHistory: history,
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  bootstrapped: false,
  loading: false,
  error: null,

  bootstrap: async () => {
    if (get().bootstrapped) return;
    set({ loading: true, error: null });
    try {
      await api.health();
      let projects = await api.listProjects();
      // Do NOT auto-seed demo data. DataPrism should start empty and require user upload/import.
      if (projects.length === 0) {
        const created = await api.createProject({ name: "Project Alpha" });
        projects = [created];
      }
      const currentProjectId = projects[0]?.id ?? null;
      set({ projects, currentProjectId });
      if (currentProjectId) {
        await loadProjectData(currentProjectId, set);
        // Do not auto-open any table. User should import/upload first.
      }
      set({ bootstrapped: true, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Failed to bootstrap" });
    }
  },

  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  projects: [],
  currentProjectId: null,

  setCurrentProject: async (projectId) => {
    set({ currentProjectId: projectId, loading: true, error: null });
    try {
      await loadProjectData(projectId, set);
      set({ loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Failed to load project" });
    }
  },

  createProject: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set({ loading: true, error: null });
    try {
      const created = await api.createProject({ name: trimmed });
      const projects = await api.listProjects();
      set({
        projects,
        currentProjectId: created.id,
        openTableIds: [],
        activeTableId: null,
        tableData: {},
        summaryByTableId: {},
        qualityByTableId: {},
        chartsByTableId: {},
      });
      await loadProjectData(created.id, set);
      set({ loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Failed to create project" });
    }
  },

  deleteProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteProject(projectId);
      const projects = await api.listProjects();
      const nextProject = projects[0] ?? null;
      set({
        projects,
        currentProjectId: nextProject?.id ?? null,
        openTableIds: [],
        activeTableId: null,
        tables: [],
        files: [],
        relations: [],
        lineages: [],
        tableData: {},
        summaryByTableId: {},
        qualityByTableId: {},
        chartsByTableId: {},
        operationHistory: [],
      });
      if (nextProject) {
        await loadProjectData(nextProject.id, set);
      }
      set({ loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Failed to delete project" });
    }
  },

  createDemoIfEmpty: async () => {
    const projects = await api.listProjects();
    if (projects.length > 0) return;
    await api.seedDemo();
  },

  files: [],
  importDataset: async (file) => {
    const projectId = get().currentProjectId;
    if (!projectId) throw new Error("No project selected");
    await get().importDatasetToProject(projectId, file);
  },

  importDatasetToProject: async (projectId, file) => {
    set({ loading: true, error: null });
    try {
      // Switch context so user can immediately see imported table.
      if (get().currentProjectId !== projectId) {
        set({
          currentProjectId: projectId,
          openTableIds: [],
          activeTableId: null,
          tableData: {},
          summaryByTableId: {},
          qualityByTableId: {},
          chartsByTableId: {},
        });
        await loadProjectData(projectId, set);
      }
      const res = await api.importFile(projectId, file);
      await loadProjectData(projectId, set);
      await get().openTable(res.table.id);
      // UX: after import, users typically want to check data quality first.
      set({ activeResultTab: "quality", loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Import failed" });
    }
  },

  importDatasetAsNewProject: async (file) => {
    const base = file.name.replace(/\.[^.]+$/, "").trim();
    const name = base ? base.slice(0, 48) : "New Project";
    set({ loading: true, error: null });
    try {
      const created = await api.createProject({ name });
      const projects = await api.listProjects();
      set({
        projects,
        currentProjectId: created.id,
        openTableIds: [],
        activeTableId: null,
        tableData: {},
        summaryByTableId: {},
        qualityByTableId: {},
        chartsByTableId: {},
      });
      await loadProjectData(created.id, set);
      await get().importDatasetToProject(created.id, file);
      set({ loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Import failed" });
    }
  },

  tables: [],
  openTableIds: [],
  activeTableId: null,

  openTable: async (tableId) => {
    const { openTableIds } = get();
    if (!openTableIds.includes(tableId)) {
      set({ openTableIds: [...openTableIds, tableId], activeTableId: tableId });
    } else {
      set({ activeTableId: tableId });
    }
    await get().fetchTableRows(tableId, { offset: 0 });
  },

  closeTable: (tableId) => {
    const { openTableIds, activeTableId } = get();
    const newOpenIds = openTableIds.filter((id) => id !== tableId);
    const newActiveId = activeTableId === tableId ? newOpenIds[newOpenIds.length - 1] || null : activeTableId;
    set({ openTableIds: newOpenIds, activeTableId: newActiveId });
  },

  setActiveTable: (tableId) => set({ activeTableId: tableId }),

  tableData: {},

  fetchTableRows: async (tableId, opts) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;

    const prev: TableDataState =
      get().tableData[tableId] ?? {
        rows: [],
        totalRows: 0,
        offset: 0,
        limit: 500,
        sort: [],
        loading: false,
        error: null,
      };
    const next: TableDataState = {
      ...prev,
      ...opts,
      loading: true,
      error: null,
    };
    set((s: AppState) => ({
      tableData: { ...s.tableData, [tableId]: next },
    }));

    try {
      const res = await api.queryRows(projectId, tableId, {
        offset: next.offset,
        limit: next.limit,
        sort: next.sort,
      });
      set((s: AppState) => ({
        tableData: {
          ...s.tableData,
          [tableId]: { ...next, rows: res.rows, totalRows: res.totalRows, loading: false },
        },
      }));
    } catch (e: any) {
      set((s: AppState) => ({
        tableData: {
          ...s.tableData,
          [tableId]: { ...next, loading: false, error: e?.message ?? "Failed to load rows" },
        },
      }));
    }
  },

  relations: [],
  lineages: [],
  selectedRelationId: null,
  setSelectedRelation: (relationId) => set({ selectedRelationId: relationId }),

  selectedNodeId: null,
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

  hiddenCanvasTableIds: [],
  removeFromCanvas: (tableId) => {
    const { hiddenCanvasTableIds } = get();
    if (!hiddenCanvasTableIds.includes(tableId)) {
      set({ hiddenCanvasTableIds: [...hiddenCanvasTableIds, tableId] });
    }
  },
  addToCanvas: (tableId) => {
    set({ hiddenCanvasTableIds: get().hiddenCanvasTableIds.filter(id => id !== tableId) });
  },

  activeResultTab: "summary",
  setActiveResultTab: (tab) => set({ activeResultTab: tab }),

  operationHistory: [],
  refreshHistory: async () => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const history = await api.history(projectId);
    set({ operationHistory: history });
  },

  undoLastOperation: async () => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    await api.undo(projectId);
    await loadProjectData(projectId, set);
    const activeTableId = get().activeTableId;
    if (activeTableId) {
      await get().fetchTableRows(activeTableId, { offset: 0 });
    }
  },

  summaryByTableId: {},
  qualityByTableId: {},
  chartsByTableId: {},
  chartsLoadingByTableId: {},
  chartsErrorByTableId: {},

  fetchSummary: async (tableId) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const s = await api.summary(projectId, tableId);
    set((state: AppState) => ({ summaryByTableId: { ...state.summaryByTableId, [tableId]: s } }));
  },

  fetchQuality: async (tableId) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const q = await api.quality(projectId, tableId);
    set((state: AppState) => ({ qualityByTableId: { ...state.qualityByTableId, [tableId]: q } }));
  },

  fetchCharts: async (tableId, opts) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;

    const kind = opts?.kind ?? "histogram";
    let field = opts?.field;
    if (!field) {
      const fallback = table.fields.find((f) => ["float8", "int8", "int4"].includes(f.type));
      field = fallback?.name ?? table.fields[0]?.name;
    }
    if (!field) return;

    set((state: AppState) => ({
      chartsLoadingByTableId: { ...state.chartsLoadingByTableId, [tableId]: true },
      chartsErrorByTableId: { ...state.chartsErrorByTableId, [tableId]: undefined },
    }));

    try {
      const res = await api.charts(projectId, tableId, {
        kind,
        field,
        bins: 20,
        limit: 10,
        valueField: opts?.valueField ?? null,
      });
      set((state: AppState) => ({
        chartsByTableId: { ...state.chartsByTableId, [tableId]: res },
        chartsLoadingByTableId: { ...state.chartsLoadingByTableId, [tableId]: false },
      }));
    } catch (e: any) {
      set((state: AppState) => ({
        chartsLoadingByTableId: { ...state.chartsLoadingByTableId, [tableId]: false },
        chartsErrorByTableId: { ...state.chartsErrorByTableId, [tableId]: e?.message ?? "Chart failed" },
      }));
    }
  },

  cleanColumns: async (tableId, action, columns) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    await api.clean(projectId, tableId, { action, fields: columns });
    await loadProjectData(projectId, set);
    await get().fetchTableRows(tableId, { offset: 0 });
    await get().refreshHistory();
    set({ activeResultTab: "quality" });
  },

  exportActiveTable: async (format) => {
    const projectId = get().currentProjectId;
    const tableId = get().activeTableId;
    if (!projectId || !tableId) return;
    const res = await api.exportTable(projectId, tableId, format);
    const url = res.downloadUrl.startsWith("/") ? res.downloadUrl : `/api${res.downloadUrl}`;
    window.open(url, "_blank", "noopener,noreferrer");
  },

  mergeTables: async (input) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    set({ loading: true, error: null });
    try {
      const res = await api.merge(projectId, input);
      await loadProjectData(projectId, set);
      if (res?.table?.id) {
        await get().openTable(res.table.id);
      }
      set({ loading: false });
      return res;
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Merge failed" });
      throw e;
    }
  },

  reshapeTable: async (input) => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    set({ loading: true, error: null });
    try {
      const res = await api.reshape(projectId, input);
      await loadProjectData(projectId, set);
      if (res?.table?.id) {
        await get().openTable(res.table.id);
      }
      set({ loading: false });
      return res;
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? "Reshape failed" });
      throw e;
    }
  },
}));
