import { X, Table2, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { DataGrid } from './DataGrid';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const TableWorkspace = () => {
  const { 
    tables, 
    openTableIds, 
    activeTableId, 
    setActiveTable, 
    closeTable,
    tableData,
    fetchTableRows,
    previewCleanColumns,
    cleanColumns,
    setActiveResultTab,
    importDataset,
    error,
    loading,
  } = useAppStore();

  const importRef = useRef<HTMLInputElement | null>(null);
  
  const openTables = tables.filter(t => openTableIds.includes(t.id));
  const activeTable = tables.find(t => t.id === activeTableId);
  const activeDataState = activeTableId ? tableData[activeTableId] : undefined;
  const activeData = activeDataState?.rows ?? [];

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<{ action: string; columns: string[] } | null>(null);

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
      setActiveResultTab(mapping.tab);
      
      if (action === 'summary') {
        // Summary is fetched by ResultsPanel on demand
        return;
      }
      if (mapping.type === 'clean') {
        // For higher-impact transforms, show a Preview → Apply dialog.
        if (action === 'standardize-missing' || action === 'trim' || action === 'lowercase') {
          setPendingAction({ action, columns });
          setPreviewOpen(true);
          setPreviewLoading(true);
          setPreviewError(null);
          setPreviewData(null);
          void previewCleanColumns(activeTable.id, action, columns, 10)
            .then((res) => {
              setPreviewData(res);
            })
            .catch((e: any) => {
              setPreviewError(e?.message ?? 'Preview failed');
            })
            .finally(() => {
              setPreviewLoading(false);
            });
          return;
        }

        void cleanColumns(activeTable.id, action, columns)
          .then(() => {
            toast({
              title: 'Applied change',
              description: `${action.replace(/-/g, ' ')} · ${columns.length} column${columns.length > 1 ? 's' : ''}`,
            });
          })
          .catch(() => {
            // errors are already surfaced via global error state
          });
      }
    }
  };
  
  if (openTables.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center max-w-[520px] px-6">
          <div className="w-10 h-10 rounded-full bg-foreground/[0.04] flex items-center justify-center mx-auto mb-3">
            <Table2 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <div className="mx-auto rounded-xl border border-border/60 bg-card notion-shadow-md p-6">
            <p className="text-foreground text-[13px] font-semibold">Import data. Fix issues. Export clean.</p>
            <p className="text-muted-foreground/70 text-[12px] mt-1 leading-relaxed">
              Start with a CSV/XLSX. DataPrism will surface missing values and type issues so you can export confidently.
            </p>

            <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => importRef.current?.click()}
              disabled={loading}
            >
              <Upload className="w-3.5 h-3.5" />
              Import dataset
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => toast({ title: 'Tip', description: 'Use the sidebar to open datasets once imported.' })}
            >
              What is a table?
            </Button>
          </div>

          <input
            ref={importRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void importDataset(f);
              e.currentTarget.value = '';
            }}
          />

            <div className="mt-5 text-left text-[12px] text-muted-foreground/70">
              <div className="flex items-center gap-2 py-1">
                <span className="w-4 text-muted-foreground/60">1.</span>
                <span>Import a dataset</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <span className="w-4 text-muted-foreground/60">2.</span>
                <span>Review <span className="text-foreground/80 font-medium">Quality</span> (missing values, types)</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <span className="w-4 text-muted-foreground/60">3.</span>
                <span>Export clean data (.dta / CSV)</span>
              </div>
            </div>

            {error && (
              <div className="mt-3 text-[12px] text-destructive/90" title={error}>
                {error}
              </div>
            )}
          </div>
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
                    : "text-[hsl(var(--tab-foreground))] hover:bg-foreground/[0.04] hover:text-foreground"
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
            onSortChange={(sort) => {
              if (!activeTableId) return;
              void fetchTableRows(activeTableId, { offset: 0, sort });
            }}
          />
        )}
      </div>
      
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[720px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              Preview change
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.action === 'standardize-missing'
                ? 'Standardize common missing tokens (e.g., NA, N/A, null, —, empty) to NULL.'
                : pendingAction?.action === 'trim'
                  ? 'Trim leading/trailing whitespace.'
                  : pendingAction?.action === 'lowercase'
                    ? 'Convert text to lowercase.'
                    : 'Review the impact before applying.'}
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="text-[13px] text-muted-foreground">Loading preview…</div>
          ) : previewError ? (
            <div className="text-[13px] text-destructive">{previewError}</div>
          ) : previewData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                <span>
                  Affected rows: <span className="text-foreground font-medium tabular-nums">{Number(previewData.affectedRows ?? 0).toLocaleString()}</span>
                </span>
                <span>
                  Affected cells: <span className="text-foreground font-medium tabular-nums">{Number(previewData.affectedCells ?? 0).toLocaleString()}</span>
                </span>
              </div>

              <div className="rounded-md border border-border/60 overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Sample before → after
                </div>
                <div className="max-h-[280px] overflow-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/10">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Field</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Before</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewData.samples ?? []).flatMap((row: any, idx: number) =>
                        (pendingAction?.columns ?? []).map((f) => {
                          const cell = row?.[f];
                          if (!cell) return null;
                          return (
                            <tr key={`${idx}-${f}`} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 text-muted-foreground">{f}</td>
                              <td className="px-3 py-2 text-foreground/80">{String(cell.before ?? '')}</td>
                              <td className="px-3 py-2 text-foreground/80">{cell.after === null ? <span className="text-muted-foreground/60">NULL</span> : String(cell.after ?? '')}</td>
                            </tr>
                          );
                        }).filter(Boolean) as any
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-muted-foreground">No preview available.</div>
          )}

          <DialogFooter>
            <button
              className="h-8 px-3 text-[12px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] rounded-md"
              onClick={() => setPreviewOpen(false)}
              disabled={previewLoading}
            >
              Cancel
            </button>
            <button
              className="h-8 px-3 text-[12px] rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              disabled={previewLoading || !pendingAction || (previewData && Number(previewData.affectedCells ?? 0) === 0)}
              onClick={() => {
                if (!activeTable || !pendingAction) return;
                setPreviewLoading(true);
                void cleanColumns(activeTable.id, pendingAction.action, pendingAction.columns)
                  .then(() => {
                    toast({ title: 'Applied change', description: `${pendingAction.action.replace(/-/g, ' ')} · ${pendingAction.columns.length} column${pendingAction.columns.length > 1 ? 's' : ''}` });
                    setPreviewOpen(false);
                  })
                  .catch((e: any) => {
                    toast({ title: 'Apply failed', description: e?.message ?? 'Failed', variant: 'destructive' as any });
                  })
                  .finally(() => setPreviewLoading(false));
              }}
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Bar */}
      {activeTable && (
        <div className="h-6 px-3 flex items-center gap-4 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{activeTable.rowCount.toLocaleString()} rows</span>
          <span className="tabular-nums">{activeTable.fields.length} columns</span>
          {activeDataState?.loading && (
            <span className="text-foreground/60">Loading…</span>
          )}
          {activeDataState?.error && (
            <span className="text-destructive">{activeDataState.error}</span>
          )}
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
