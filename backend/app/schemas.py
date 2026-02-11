from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


FieldType = Literal[
  "string",
  "number",
  "date",
  "boolean",
  "uuid",
  "int4",
  "int8",
  "float8",
  "text",
  "varchar",
  "timestamp",
  "timestamptz",
  "jsonb",
]


class ProjectOut(BaseModel):
  id: str
  name: str
  createdAt: datetime
  updatedAt: datetime
  tags: list[str] = Field(default_factory=list)


class ProjectCreate(BaseModel):
  name: str
  tags: list[str] = Field(default_factory=list)


class DataFileOut(BaseModel):
  id: str
  name: str
  type: Literal["csv", "xlsx", "xls"]
  size: int
  updatedAt: datetime
  projectId: str


class FieldOut(BaseModel):
  name: str
  type: FieldType
  nullable: bool
  isPrimaryKey: bool | None = None
  isUnique: bool | None = None
  isIdentity: bool | None = None
  isForeignKey: bool | None = None
  refTable: str | None = None
  refField: str | None = None
  missingCount: int | None = None
  missingRate: float | None = None


class DataTableOut(BaseModel):
  id: str
  name: str
  fields: list[FieldOut]
  rowCount: int
  sourceType: Literal["imported", "derived"]
  dirty: bool
  sourceFileId: str | None = None
  derivedFrom: list[str] | None = None
  operation: Literal["merge", "reshape", "clean"] | None = None


class RelationEdgeOut(BaseModel):
  id: str
  fkTableId: str
  fkFields: list[str]
  pkTableId: str
  pkFields: list[str]
  cardinality: Literal["1:1", "1:m", "m:1"]


class LineageEdgeOut(BaseModel):
  id: str
  derivedTableId: str
  sourceTableIds: list[str]
  operation: Literal["merge", "reshape", "clean"]


class OperationLogOut(BaseModel):
  id: str
  type: str
  tableId: str
  tableName: str
  params: dict[str, Any]
  timestamp: datetime
  undoable: bool


class SortSpec(BaseModel):
  field: str
  direction: Literal["asc", "desc"] = "asc"


class FilterSpec(BaseModel):
  field: str
  op: Literal["eq", "neq", "lt", "lte", "gt", "gte", "contains", "in", "isnull", "notnull", "between"]
  value: Any | None = None


class RowsQueryIn(BaseModel):
  offset: int = 0
  limit: int = 200
  filters: list[FilterSpec] = Field(default_factory=list)
  sort: list[SortSpec] = Field(default_factory=list)


class RowsQueryOut(BaseModel):
  rows: list[dict[str, Any]]
  totalRows: int


class NumericFieldStats(BaseModel):
  field: str
  count: int
  mean: float
  std: float
  min: float
  p25: float
  median: float
  p75: float
  max: float
  missing: int


class CategoricalFieldStats(BaseModel):
  field: str
  uniqueCount: int
  topValues: list[dict[str, Any]]
  missing: int


class SummaryResultOut(BaseModel):
  tableId: str
  tableName: str
  numericStats: list[NumericFieldStats]
  categoricalStats: list[CategoricalFieldStats]
  timestamp: datetime


class QualityReportIn(BaseModel):
  keys: list[str] | None = None


class QualityReportOut(BaseModel):
  tableId: str
  tableName: str
  totalRows: int
  totalColumns: int
  missingByColumn: list[dict[str, Any]]
  duplicatesByKey: list[dict[str, Any]]
  typeIssues: list[dict[str, Any]]
  keyConflicts: list[dict[str, Any]]
  timestamp: datetime


class SetPrimaryKeyIn(BaseModel):
  fields: list[str]


class CreateRelationIn(BaseModel):
  fkTableId: str
  fkFields: list[str]
  pkTableId: str
  pkFields: list[str]
  cardinality: Literal["1:1", "1:m", "m:1"]


class RelationReportOut(BaseModel):
  relationId: str
  fkTableId: str
  pkTableId: str
  coverage: float
  fkMissing: int
  fkDuplicateRows: int
  pkDuplicateRows: int
  timestamp: datetime


class MergeIn(BaseModel):
  leftTableId: str
  rightTableId: str
  leftKeys: list[str]
  rightKeys: list[str]
  joinType: Literal["1:1", "1:m", "m:1"]
  how: Literal["full", "left", "right", "inner"] = "full"
  resultName: str | None = None


class MergeReportOut(BaseModel):
  id: str
  leftTable: str
  rightTable: str
  resultTable: str
  joinType: Literal["1:1", "1:m", "m:1"]
  keyFields: list[str]
  rowsBefore: dict[str, int]
  rowsAfter: int
  matchedRows: int
  unmatchedLeft: int
  unmatchedRight: int
  timestamp: datetime


class ReshapeIn(BaseModel):
  tableId: str
  direction: Literal["wide-to-long", "long-to-wide"]
  idVars: list[str]
  valueVars: list[str]
  variableName: str = "variable"
  valueName: str = "value"
  resultName: str | None = None
  pivotColumns: str | None = None
  pivotValues: str | None = None


class ReshapeReportOut(BaseModel):
  id: str
  sourceTable: str
  resultTable: str
  direction: Literal["wide-to-long", "long-to-wide"]
  idVars: list[str]
  valueVars: list[str]
  rowsBefore: int
  rowsAfter: int
  columnsBefore: int
  columnsAfter: int
  timestamp: datetime


class ExportIn(BaseModel):
  format: Literal["csv", "dta"] = "csv"


class ExportOut(BaseModel):
  format: Literal["csv", "dta"]
  filename: str
  downloadUrl: str
  timestamp: datetime


class CleanIn(BaseModel):
  action: Literal["drop-missing", "fill-mean", "fill-median", "trim", "lowercase"]
  fields: list[str]


class CleanOut(BaseModel):
  operationId: str
  tableId: str
  timestamp: datetime


class ChartIn(BaseModel):
  kind: Literal["histogram", "bar", "line"]
  field: str
  bins: int = 20
  limit: int = 10
  valueField: str | None = None


class ChartOut(BaseModel):
  kind: str
  field: str
  data: dict[str, Any]
  timestamp: datetime
