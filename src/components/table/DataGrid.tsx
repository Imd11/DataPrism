import { useMemo, useRef, useCallback } from 'react';
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
import { useState } from 'react';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Type,
  Hash,
  Calendar,
  ToggleLeft
} from 'lucide-react';

interface DataGridProps {
  data: RowData[];
  fields: Field[];
  onCellClick?: (rowIndex: number, columnId: string) => void;
}

const getTypeIcon = (type: Field['type']) => {
  switch (type) {
    case 'string':
      return <Type className="w-3 h-3" />;
    case 'number':
      return <Hash className="w-3 h-3" />;
    case 'date':
      return <Calendar className="w-3 h-3" />;
    case 'boolean':
      return <ToggleLeft className="w-3 h-3" />;
    default:
      return <Type className="w-3 h-3" />;
  }
};

export const DataGrid = ({ data, fields, onCellClick }: DataGridProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const columns = useMemo<ColumnDef<RowData>[]>(() => {
    return fields.map((field) => ({
      accessorKey: field.name,
      header: ({ column }) => (
        <button
          className="flex items-center gap-1.5 w-full text-left group"
          onClick={() => column.toggleSorting()}
        >
          <span className="text-muted-foreground/60">{getTypeIcon(field.type)}</span>
          <span className="font-medium">{field.name}</span>
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-primary" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="w-3 h-3 text-primary" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      ),
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
  }, [fields]);
  
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
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="bg-table-header border-b border-table-border">
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-sm font-medium text-foreground/80 whitespace-nowrap border-r border-table-border last:border-r-0"
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
                    className="px-3 py-2 text-sm text-foreground/90 whitespace-nowrap border-r border-table-border last:border-r-0 max-w-[200px] overflow-hidden"
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
