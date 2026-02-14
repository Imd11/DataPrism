import { useMemo, useRef, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  Header,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import type { RowData, Field } from '@/types/data';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  Filter,
  BarChart3,
  Sparkles,
  Trash2,
  Copy,
  EyeOff,
  Check,
  AlignLeft,
  GripVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

interface DataGridProps {
  data: RowData[];
  fields: Field[];
  onCellClick?: (rowIndex: number, columnId: string) => void;
  onColumnAction?: (action: string, columns: string[]) => void;
  onSortChange?: (sort: { field: string; direction: 'asc' | 'desc' }[]) => void;
}

const getTypeIcon = (type: Field['type']) => {
  switch (type) {
    case 'string':
    case 'text':
    case 'varchar':
      return <AlignLeft className="w-3.5 h-3.5" />;
    case 'number':
    case 'int4':
    case 'int8':
    case 'float8':
      return <Hash className="w-3.5 h-3.5" />;
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'boolean':
      return <ToggleLeft className="w-3.5 h-3.5" />;
    default:
      return <Type className="w-3.5 h-3.5" />;
  }
};

// Column resize handle component
const ColumnResizeHandle = ({ header }: { header: Header<RowData, unknown> }) => {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
        "hover:bg-foreground/20 active:bg-foreground/30",
        header.column.getIsResizing() && "bg-foreground/30"
      )}
    />
  );
};

export const DataGrid = ({ data, fields, onCellClick, onColumnAction, onSortChange }: DataGridProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  
  // Drag state for column reordering
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const toggleColumnSelection = (fieldName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelection = new Set(selectedColumns);
    
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      if (newSelection.has(fieldName)) {
        newSelection.delete(fieldName);
      } else {
        newSelection.add(fieldName);
      }
    } else {
      if (newSelection.has(fieldName) && newSelection.size === 1) {
        newSelection.clear();
      } else {
        newSelection.clear();
        newSelection.add(fieldName);
      }
    }
    
    setSelectedColumns(newSelection);
  };
  
  const handleColumnAction = (action: string) => {
    const columns = Array.from(selectedColumns);
    if (columns.length > 0) {
      onColumnAction?.(action, columns);
    }
  };
  
  // Drag handlers for column reordering
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'px-3 py-1 bg-background border border-border rounded shadow-lg text-sm';
    dragImage.textContent = columnId;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedColumn) {
      setDragOverColumn(columnId);
    }
  }, [draggedColumn]);
  
  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnId) {
      handleDragEnd();
      return;
    }
    
    const currentOrder = columnOrder.length > 0 
      ? columnOrder 
      : fields.map(f => f.name);
    
    const draggedIndex = currentOrder.indexOf(draggedColumn);
    const targetIndex = currentOrder.indexOf(targetColumnId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }
    
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);
    
    setColumnOrder(newOrder);
    handleDragEnd();
  }, [draggedColumn, columnOrder, fields, handleDragEnd]);
  
  const columns = useMemo<ColumnDef<RowData>[]>(() => {
    return fields.map((field) => ({
      accessorKey: field.name,
      size: 150,
      minSize: 80,
      maxSize: 500,
      header: ({ column }) => {
        const isSelected = selectedColumns.has(field.name);
        const selectedCount = selectedColumns.size;
        const isDragging = draggedColumn === field.name;
        const isDragOver = dragOverColumn === field.name;
        
        return (
          <div 
            className={cn(
              "flex items-center gap-1 w-full",
              isDragging && "opacity-50",
              isDragOver && "bg-foreground/[0.08]"
            )}
          >
            {/* Drag handle */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, field.name)}
              onDragOver={(e) => handleDragOver(e, field.name)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, field.name)}
              className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-foreground/[0.08] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <GripVertical className="w-3 h-3" />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 flex-1 text-left group px-1 py-1 rounded-sm transition-colors duration-75",
                    "hover:bg-foreground/[0.05]",
                    isSelected && "bg-foreground/[0.06]"
                  )}
                  onClick={(e) => toggleColumnSelection(field.name, e)}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  )}
                  <span className="text-muted-foreground/60">{getTypeIcon(field.type)}</span>
                  <span className={cn(
                    "text-[13px] flex-1 truncate",
                    isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {field.name}
                  </span>
                  {column.getIsSorted() === 'asc' ? (
                    <ArrowUp className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  ) : column.getIsSorted() === 'desc' ? (
                    <ArrowDown className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  ) : (
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 notion-popover-shadow">
                {selectedCount > 1 && (
                  <>
                    <div className="px-3 py-2 text-xs text-muted-foreground font-medium">
                      {selectedCount} columns selected
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                <DropdownMenuItem onClick={() => column.toggleSorting(false)} className="gap-2.5 py-2">
                  <ArrowUp className="w-4 h-4 text-muted-foreground" />
                  <span>Sort ascending</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true)} className="gap-2.5 py-2">
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                  <span>Sort descending</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleColumnAction('filter')} className="gap-2.5 py-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span>Filter{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleColumnAction('summary')} className="gap-2.5 py-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span>Calculate{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}</span>
                </DropdownMenuItem>
                
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2.5 py-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span>Clean{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="notion-popover-shadow">
                    <DropdownMenuItem onClick={() => handleColumnAction('drop-missing')} className="py-2">
                      Drop rows with missing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleColumnAction('fill-mean')} className="py-2">
                      Fill with mean
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleColumnAction('fill-median')} className="py-2">
                      Fill with median
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleColumnAction('trim')} className="py-2">
                      Trim whitespace
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleColumnAction('lowercase')} className="py-2">
                      Convert to lowercase
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleColumnAction('copy')} className="gap-2.5 py-2">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  <span>Copy column{selectedCount > 1 ? 's' : ''}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleColumnAction('hide')} className="gap-2.5 py-2">
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                  <span>Hide column{selectedCount > 1 ? 's' : ''}</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleColumnAction('delete')}
                  className="gap-2.5 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete column{selectedCount > 1 ? 's' : ''}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground/35 text-[13px]">empty</span>;
        }
        if (typeof value === 'number') {
          return <span className="table-mono text-foreground/80">{value.toLocaleString()}</span>;
        }
        return <span className="text-[13px] text-foreground/80 truncate block">{String(value)}</span>;
      },
    }));
  }, [fields, selectedColumns, draggedColumn, dragOverColumn, handleDragStart, handleDragOver, handleDragEnd, handleDrop]);
  
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnOrder,
      columnSizing,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      if (onSortChange) {
        const mapped = next.map((s) => ({
          field: String(s.id),
          direction: s.desc ? 'desc' : 'asc',
        }));
        onSortChange(mapped);
      }
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    // Sorting/filtering should be done server-side (for large tables).
    // UI still displays current state, and callers may re-query data.
    manualSorting: true,
    manualFiltering: true,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });
  
  const { rows } = table.getRowModel();
  
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 34,
    overscan: 10,
  });
  
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
    : 0;

  // Calculate column sizes for the table
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table.getState().columnSizing]);
  
  return (
    <div 
      ref={tableContainerRef}
      className="h-full overflow-auto"
    >
      {/* Selection indicator */}
      {selectedColumns.size > 0 && (
        <div className="sticky top-0 left-0 right-0 z-20 px-3 py-1.5 bg-foreground/[0.06] border-b border-foreground/10 text-[13px] text-foreground flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span className="font-medium">{selectedColumns.size} column{selectedColumns.size > 1 ? 's' : ''} selected</span>
          <span className="text-foreground/50">· Hold Shift/Ctrl/⌘ to multi-select</span>
          <button 
            className="ml-auto text-[13px] hover:underline underline-offset-2"
            onClick={() => setSelectedColumns(new Set())}
          >
            Clear
          </button>
        </div>
      )}
      
      <table 
        className="w-full border-collapse"
        style={{
          ...columnSizeVars,
          width: table.getTotalSize(),
        }}
      >
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="bg-table-header border-b border-table-border">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className={cn(
                    "px-2 py-2 text-left text-[13px] font-normal whitespace-nowrap border-r border-table-border last:border-r-0 relative",
                    selectedColumns.has(header.column.id) && "bg-foreground/[0.03]"
                  )}
                  style={{ 
                    width: header.getSize(),
                    minWidth: header.column.columnDef.minSize,
                    maxWidth: header.column.columnDef.maxSize,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  
                  {/* Column resize handle */}
                  <ColumnResizeHandle header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualRows.map(virtualRow => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-table-border transition-colors duration-75",
                  "hover:bg-table-row-hover",
                  row.getIsSelected() && "bg-table-row-selected"
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-1.5 text-[13px] whitespace-nowrap border-r border-table-border last:border-r-0 overflow-hidden",
                      selectedColumns.has(cell.column.id) && "bg-foreground/[0.02]"
                    )}
                    style={{
                      width: cell.column.getSize(),
                      maxWidth: cell.column.getSize(),
                    }}
                    onClick={() => onCellClick?.(virtualRow.index, cell.column.id)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
