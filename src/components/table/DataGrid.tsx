import { useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
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

export const DataGrid = ({ data, fields, onCellClick, onColumnAction }: DataGridProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  
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
  
  const columns = useMemo<ColumnDef<RowData>[]>(() => {
    return fields.map((field) => ({
      accessorKey: field.name,
      header: ({ column }) => {
        const isSelected = selectedColumns.has(field.name);
        const selectedCount = selectedColumns.size;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 w-full text-left group px-1.5 py-1 -mx-1.5 rounded-sm transition-colors duration-75",
                  "hover:bg-foreground/[0.05]",
                  isSelected && "bg-primary/8"
                )}
                onClick={(e) => toggleColumnSelection(field.name, e)}
              >
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
                <span className="text-muted-foreground/60">{getTypeIcon(field.type)}</span>
                <span className={cn(
                  "text-[13px] flex-1",
                  isSelected ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {field.name}
                </span>
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5 text-primary" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
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
        return <span className="text-[13px] text-foreground/80 truncate">{String(value)}</span>;
      },
    }));
  }, [fields, selectedColumns]);
  
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
  
  return (
    <div 
      ref={tableContainerRef}
      className="h-full overflow-auto"
    >
      {/* Selection indicator */}
      {selectedColumns.size > 0 && (
        <div className="sticky top-0 left-0 right-0 z-20 px-3 py-1.5 bg-primary/[0.08] border-b border-primary/15 text-[13px] text-primary flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span className="font-medium">{selectedColumns.size} column{selectedColumns.size > 1 ? 's' : ''} selected</span>
          <span className="text-primary/60">· Hold Shift or ⌘ to multi-select</span>
          <button 
            className="ml-auto text-[13px] hover:underline underline-offset-2"
            onClick={() => setSelectedColumns(new Set())}
          >
            Clear
          </button>
        </div>
      )}
      
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="bg-table-header border-b border-table-border">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className={cn(
                    "px-3 py-2 text-left text-[13px] font-normal whitespace-nowrap border-r border-table-border last:border-r-0",
                    selectedColumns.has(header.column.id) && "bg-primary/[0.04]"
                  )}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
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
                      "px-3 py-1.5 text-[13px] whitespace-nowrap border-r border-table-border last:border-r-0 max-w-[220px] overflow-hidden",
                      selectedColumns.has(cell.column.id) && "bg-primary/[0.03]"
                    )}
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