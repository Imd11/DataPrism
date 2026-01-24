import { X } from 'lucide-react';
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
    
    // Map actions to operation types
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
          <p className="text-muted-foreground text-sm">No tables open</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            Click a table in the sidebar to open it
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Bar */}
      <div className="h-9 flex items-center border-b border-border bg-muted/30 overflow-x-auto">
        <AnimatePresence mode="popLayout">
          {openTables.map(table => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
            >
              <button
                className={cn(
                  "group h-9 px-3 flex items-center gap-2 border-r border-border text-sm transition-colors",
                  table.id === activeTableId
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
                onClick={() => setActiveTable(table.id)}
              >
                <span className="max-w-[120px] truncate">{table.name}</span>
                {table.dirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-dirty" title="Modified" />
                )}
                {table.sourceType === 'derived' && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    derived
                  </span>
                )}
                <button
                  className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTable(table.id);
                  }}
                >
                  <X className="w-3 h-3" />
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
        <div className="h-6 px-3 flex items-center gap-4 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span>{activeTable.rowCount.toLocaleString()} rows</span>
          <span>{activeTable.fields.length} columns</span>
          {activeTable.dirty && (
            <span className="text-dirty font-medium">Modified</span>
          )}
          {activeTable.sourceType === 'derived' && (
            <span className="text-primary">
              Derived from {activeTable.derivedFrom?.length || 0} table(s)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
