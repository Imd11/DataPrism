import { X, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { DataGrid } from './DataGrid';
import { motion, AnimatePresence } from 'framer-motion';

export const TableWorkspace = () => {
  const { 
    tables, 
    openTableIds, 
    activeTableId, 
    setActiveTable, 
    closeTable,
    getTableData,
    addOperation,
    setActiveResultTab
  } = useAppStore();
  
  const openTables = tables.filter(t => openTableIds.includes(t.id));
  const activeTable = tables.find(t => t.id === activeTableId);
  const activeData = activeTableId ? getTableData(activeTableId) : [];
  
  const handleColumnAction = (action: string, columns: string[]) => {
    if (!activeTable) return;
    
    const actionMap: Record<string, { type: string; tab: 'summary' | 'quality' | 'history' }> = {
      'summary': { type: 'summary', tab: 'summary' },
      'filter': { type: 'filter', tab: 'history' },
      'drop-missing': { type: 'clean', tab: 'quality' },
      'fill-mean': { type: 'clean', tab: 'quality' },
      'fill-median': { type: 'clean', tab: 'quality' },
      'trim': { type: 'clean', tab: 'quality' },
      'lowercase': { type: 'clean', tab: 'quality' },
      'copy': { type: 'clean', tab: 'history' },
      'hide': { type: 'clean', tab: 'history' },
      'delete': { type: 'clean', tab: 'history' },
    };
    
    const mapping = actionMap[action];
    if (mapping) {
      addOperation({
        type: mapping.type as any,
        tableId: activeTable.id,
        tableName: activeTable.name,
        params: { action, columns },
        undoable: action !== 'summary',
      });
      setActiveResultTab(mapping.tab);
    }
  };
  
  if (openTables.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full bg-foreground/[0.04] flex items-center justify-center mx-auto mb-3">
            <Table2 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="text-foreground/70 text-[13px] font-medium">No tables open</p>
          <p className="text-muted-foreground/60 text-[12px] mt-1">
            Click a dataset in the sidebar to open it
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Bar - Elevated from table content */}
      <div className="flex items-center border-b border-border bg-[hsl(var(--tab-background))] overflow-x-auto shrink-0">
        <AnimatePresence mode="popLayout">
          {openTables.map(table => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <button
                className={cn(
                  "group h-10 px-4 flex items-center gap-2.5 border-r border-border transition-all duration-75",
                  table.id === activeTableId
                    ? "bg-[hsl(var(--tab-active-background))] text-foreground font-medium shadow-[inset_0_-2px_0_hsl(var(--foreground)/0.8)]"
                    : "text-[hsl(var(--tab-foreground))] hover:bg-foreground/[0.06] hover:text-foreground"
                )}
                onClick={() => setActiveTable(table.id)}
              >
                <span className="max-w-[140px] truncate text-[13px]">{table.name}</span>
                {table.dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-dirty" title="Modified" />
                )}
                {table.sourceType === 'derived' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-foreground/10 text-foreground/70 font-medium">
                    derived
                  </span>
                )}
                <button
                  className="p-0.5 rounded-sm hover:bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-75 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTable(table.id);
                  }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Data Grid */}
      <div className="flex-1 min-h-0">
        {activeTable && (
          <DataGrid 
            data={activeData}
            fields={activeTable.fields}
            onColumnAction={handleColumnAction}
          />
        )}
      </div>
      
      {/* Status Bar */}
      {activeTable && (
        <div className="h-6 px-3 flex items-center gap-4 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{activeTable.rowCount.toLocaleString()} rows</span>
          <span className="tabular-nums">{activeTable.fields.length} columns</span>
          {activeTable.dirty && (
            <span className="text-dirty font-medium">Modified</span>
          )}
          {activeTable.sourceType === 'derived' && (
            <span className="text-foreground/60">
              Derived from {activeTable.derivedFrom?.length || 0} table(s)
            </span>
          )}
        </div>
      )}
    </div>
  );
};