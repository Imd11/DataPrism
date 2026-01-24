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
  Eye,
  EyeOff,
  Check,
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
      return <Type className="w-3 h-3" />;
    case 'number':
    case 'int4':
    case 'int8':
    case 'float8':
      return <Hash className="w-3 h-3" />;
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return <Calendar className="w-3 h-3" />;
    case 'boolean':
      return <ToggleLeft className="w-3 h-3" />;
    default:
      return <Type className="w-3 h-3" />;
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
      // Multi-select mode
      if (newSelection.has(fieldName)) {
        newSelection.delete(fieldName);
      } else {
        newSelection.add(fieldName);
      }
    } else {
      // Single select mode - clear others
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
                  "flex items-center gap-1.5 w-full text-left group px-1 py-0.5 -mx-1 rounded transition-colors",
                  isSelected && "bg-primary/10"
                )}
                onClick={(e) => toggleColumnSelection(field.name, e)}
              >
                {isSelected && (
                  <Check className="w-3 h-3 text-primary flex-shrink-0" />
                )}
                <span className="text-muted-foreground/60">{getTypeIcon(field.type)}</span>
                <span className={cn("font-medium flex-1", isSelected && "text-primary")}>
                  {field.name}
                </span>
                {column.getIsSorted() === 'asc' ? (
                  <ArrowUp className="w-3 h-3 text-primary" />
                ) : column.getIsSorted() === 'desc' ? (
                  <ArrowDown className="w-3 h-3 text-primary" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
              {selectedCount > 1 && (
                <>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                    {selectedCount} columns selected
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {/* Sort */}
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="w-3.5 h-3.5 mr-2" />
                Sort Ascending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="w-3.5 h-3.5 mr-2" />
                Sort Descending
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Filter */}
              <DropdownMenuItem onClick={() => handleColumnAction('filter')}>
                <Filter className="w-3.5 h-3.5 mr-2" />
                Filter{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Analyze */}
              <DropdownMenuItem onClick={() => handleColumnAction('summary')}>
                <BarChart3 className="w-3.5 h-3.5 mr-2" />
                Analyze{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}
              </DropdownMenuItem>
              
              {/* Clean submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  Clean{selectedCount > 1 ? ` (${selectedCount} cols)` : ''}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-popover">
                  <DropdownMenuItem onClick={() => handleColumnAction('drop-missing')}>
                    Drop rows with missing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleColumnAction('fill-mean')}>
                    Fill with mean
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleColumnAction('fill-median')}>
                    Fill with median
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleColumnAction('trim')}>
                    Trim whitespace
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleColumnAction('lowercase')}>
                    Convert to lowercase
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              <DropdownMenuSeparator />
              
              {/* Column operations */}
              <DropdownMenuItem onClick={() => handleColumnAction('copy')}>
                <Copy className="w-3.5 h-3.5 mr-2" />
                Copy column{selectedCount > 1 ? 's' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleColumnAction('hide')}>
                <EyeOff className="w-3.5 h-3.5 mr-2" />
                Hide column{selectedCount > 1 ? 's' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleColumnAction('delete')}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete column{selectedCount > 1 ? 's' : ''}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground/40 italic">null</span>;
        }
        if (typeof value === 'number') {
          return <span className="font-mono text-sm">{value.toLocaleString()}</span>;
        }
        return <span className="truncate">{String(value)}</span>;
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
    estimateSize: () => 36,
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
        <div className="sticky top-0 left-0 right-0 z-20 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs text-primary flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{selectedColumns.size} column{selectedColumns.size > 1 ? 's' : ''} selected</span>
          <span className="text-primary/60">• Hold Shift/Ctrl to multi-select</span>
          <button 
            className="ml-auto hover:underline"
            onClick={() => setSelectedColumns(new Set())}
          >
            Clear selection
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
                    "px-3 py-2 text-left text-sm font-medium text-foreground/80 whitespace-nowrap border-r border-table-border last:border-r-0",
                    selectedColumns.has(header.column.id) && "bg-primary/5"
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
                  "border-b border-table-border hover:bg-table-row-hover transition-colors",
                  row.getIsSelected() && "bg-table-row-selected"
                )}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-2 text-sm text-foreground/90 whitespace-nowrap border-r border-table-border last:border-r-0 max-w-[200px] overflow-hidden",
                      selectedColumns.has(cell.column.id) && "bg-primary/5"
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
