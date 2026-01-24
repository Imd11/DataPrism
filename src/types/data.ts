// Core data types for LinkData

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface DataFile {
  id: string;
  name: string;
  type: 'csv' | 'xlsx' | 'xls';
  size: number;
  updatedAt: Date;
  projectId: string;
}

export type FieldType = 'string' | 'number' | 'date' | 'boolean';

export interface Field {
  name: string;
  type: FieldType;
  nullable: boolean;
  missingCount?: number;
  missingRate?: number;
}

export interface DataTable {
  id: string;
  name: string;
  fields: Field[];
  rowCount: number;
  sourceType: 'imported' | 'derived';
  dirty: boolean;
  sourceFileId?: string;
  derivedFrom?: string[]; // table ids for lineage
  operation?: 'merge' | 'reshape' | 'clean';
}

export interface PrimaryKey {
  tableId: string;
  fields: string[];
}

export interface ForeignKey {
  tableId: string;
  fields: string[];
  refTableId: string;
  refFields: string[];
}

export interface RelationEdge {
  id: string;
  fkTableId: string;
  fkFields: string[];
  pkTableId: string;
  pkFields: string[];
  cardinality: '1:1' | '1:m' | 'm:1';
}

export interface LineageEdge {
  id: string;
  derivedTableId: string;
  sourceTableIds: string[];
  operation: 'merge' | 'reshape' | 'clean';
}

export type OperationType = 
  | 'clean' 
  | 'merge' 
  | 'reshape' 
  | 'filter' 
  | 'sort' 
  | 'summary' 
  | 'chart';

export interface OperationLog {
  id: string;
  type: OperationType;
  tableId: string;
  tableName: string;
  params: Record<string, unknown>;
  timestamp: Date;
  undoable: boolean;
}

// Result types
export interface SummaryResult {
  tableId: string;
  tableName: string;
  numericStats: NumericFieldStats[];
  categoricalStats: CategoricalFieldStats[];
  timestamp: Date;
}

export interface NumericFieldStats {
  field: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  missing: number;
}

export interface CategoricalFieldStats {
  field: string;
  uniqueCount: number;
  topValues: { value: string; count: number }[];
  missing: number;
}

export interface QualityReport {
  tableId: string;
  tableName: string;
  totalRows: number;
  totalColumns: number;
  missingByColumn: { field: string; count: number; rate: number }[];
  duplicatesByKey: { key: string[]; count: number; rate: number }[];
  typeIssues: { field: string; issues: string[] }[];
  keyConflicts: { key: string[]; message: string }[];
  timestamp: Date;
}

export interface MergeReport {
  id: string;
  leftTable: string;
  rightTable: string;
  resultTable: string;
  joinType: '1:1' | '1:m' | 'm:1';
  keyFields: string[];
  rowsBefore: { left: number; right: number };
  rowsAfter: number;
  matchedRows: number;
  unmatchedLeft: number;
  unmatchedRight: number;
  timestamp: Date;
}

export interface ReshapeReport {
  id: string;
  sourceTable: string;
  resultTable: string;
  direction: 'wide-to-long' | 'long-to-wide';
  idVars: string[];
  valueVars: string[];
  rowsBefore: number;
  rowsAfter: number;
  columnsBefore: number;
  columnsAfter: number;
  timestamp: Date;
}

// Row data type
export type RowData = Record<string, string | number | boolean | null>;
