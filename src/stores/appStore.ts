import { create } from 'zustand';
import type { 
  Project, 
  DataFile, 
  DataTable, 
  RelationEdge, 
  LineageEdge, 
  OperationLog,
  SummaryResult,
  QualityReport,
  MergeReport,
  ReshapeReport,
  RowData
} from '@/types/data';
import { mockProjects, mockFiles, mockTables, mockRelations, mockLineages, mockTableData } from '@/data/mockData';

interface AppState {
  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Project state
  projects: Project[];
  currentProjectId: string | null;
  setCurrentProject: (projectId: string) => void;
  
  // Files state
  files: DataFile[];
  
  // Tables state
  tables: DataTable[];
  openTableIds: string[];
  activeTableId: string | null;
  openTable: (tableId: string) => void;
  closeTable: (tableId: string) => void;
  setActiveTable: (tableId: string) => void;
  getTableData: (tableId: string) => RowData[];
  
  // Relations & Lineage
  relations: RelationEdge[];
  lineages: LineageEdge[];
  selectedRelationId: string | null;
  setSelectedRelation: (relationId: string | null) => void;
  
  // Canvas state
  selectedNodeId: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  
  // Results state
  activeResultTab: 'summary' | 'charts' | 'quality' | 'merge' | 'reshape' | 'history';
  setActiveResultTab: (tab: AppState['activeResultTab']) => void;
  
  // Operation history
  operationHistory: OperationLog[];
  addOperation: (operation: Omit<OperationLog, 'id' | 'timestamp'>) => void;
  undoLastOperation: () => void;
  
  // Results data
  summaryResults: SummaryResult[];
  qualityReports: QualityReport[];
  mergeReports: MergeReport[];
  reshapeReports: ReshapeReport[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  // Projects
  projects: mockProjects,
  currentProjectId: mockProjects[0]?.id || null,
  setCurrentProject: (projectId) => set({ currentProjectId: projectId }),
  
  // Files
  files: mockFiles,
  
  // Tables
  tables: mockTables,
  openTableIds: [mockTables[0]?.id, mockTables[1]?.id].filter(Boolean) as string[],
  activeTableId: mockTables[0]?.id || null,
  
  openTable: (tableId) => {
    const { openTableIds } = get();
    if (!openTableIds.includes(tableId)) {
      set({ openTableIds: [...openTableIds, tableId], activeTableId: tableId });
    } else {
      set({ activeTableId: tableId });
    }
  },
  
  closeTable: (tableId) => {
    const { openTableIds, activeTableId } = get();
    const newOpenIds = openTableIds.filter(id => id !== tableId);
    const newActiveId = activeTableId === tableId 
      ? newOpenIds[newOpenIds.length - 1] || null
      : activeTableId;
    set({ openTableIds: newOpenIds, activeTableId: newActiveId });
  },
  
  setActiveTable: (tableId) => set({ activeTableId: tableId }),
  
  getTableData: (tableId) => {
    return mockTableData[tableId] || [];
  },
  
  // Relations & Lineage
  relations: mockRelations,
  lineages: mockLineages,
  selectedRelationId: null,
  setSelectedRelation: (relationId) => set({ selectedRelationId: relationId }),
  
  // Canvas
  selectedNodeId: null,
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  
  // Results
  activeResultTab: 'summary',
  setActiveResultTab: (tab) => set({ activeResultTab: tab }),
  
  // Operation history
  operationHistory: [],
  addOperation: (operation) => {
    const newOp: OperationLog = {
      ...operation,
      id: `op-${Date.now()}`,
      timestamp: new Date(),
    };
    set((state) => ({ 
      operationHistory: [newOp, ...state.operationHistory] 
    }));
  },
  undoLastOperation: () => {
    const { operationHistory } = get();
    const undoable = operationHistory.find(op => op.undoable);
    if (undoable) {
      set((state) => ({
        operationHistory: state.operationHistory.filter(op => op.id !== undoable.id)
      }));
    }
  },
  
  // Results data (mock for now)
  summaryResults: [],
  qualityReports: [],
  mergeReports: [],
  reshapeReports: [],
}));
