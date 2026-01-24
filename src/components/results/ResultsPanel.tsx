import { 
  BarChart3, 
  PieChart, 
  AlertTriangle, 
  GitMerge, 
  Shuffle, 
  History,
  Copy,
  Download,
  Undo2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import { generateMockSummary, generateMockQuality } from '@/data/mockData';

const tabs = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'charts', label: 'Charts', icon: PieChart },
  { id: 'quality', label: 'Quality', icon: AlertTriangle },
  { id: 'merge', label: 'Merge', icon: GitMerge },
  { id: 'reshape', label: 'Reshape', icon: Shuffle },
  { id: 'history', label: 'History', icon: History },
] as const;

export const ResultsPanel = () => {
  const { 
    activeResultTab, 
    setActiveResultTab, 
    tables, 
    activeTableId,
    operationHistory 
  } = useAppStore();
  
  const activeTable = tables.find(t => t.id === activeTableId);
  const summary = activeTable ? generateMockSummary(activeTable) : null;
  const quality = activeTable ? generateMockQuality(activeTable) : null;
  
  return (
    <div className="h-full flex flex-col bg-results-background">
      {/* Tab Bar */}
      <div className="h-9 flex items-center border-b border-border px-2 gap-0.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveResultTab(tab.id)}
            className={cn(
              "h-7 px-2.5 flex items-center gap-1.5 rounded-sm text-[13px] font-medium transition-colors duration-75 whitespace-nowrap",
              activeResultTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeResultTab === 'summary' && summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[13px] text-foreground">Summary: {summary.tableName}</h3>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]">
                  <Copy className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]">
                  <Download className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {summary.numericStats.length > 0 && (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Numeric Fields
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {['Field', 'Count', 'Mean', 'Std', 'Min', 'P25', 'Median', 'P75', 'Max'].map(h => (
                          <th key={h} className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.numericStats.map(stat => (
                        <tr key={stat.field} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors duration-75">
                          <td className="px-2.5 py-1.5 font-medium text-foreground">{stat.field}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.count}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.mean.toFixed(2)}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.std.toFixed(2)}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.min.toLocaleString()}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.p25.toLocaleString()}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.median.toLocaleString()}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.p75.toLocaleString()}</td>
                          <td className="px-2.5 py-1.5 table-mono text-foreground/70">{stat.max.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeResultTab === 'quality' && quality && (
          <div className="space-y-4">
            <h3 className="font-medium text-[13px] text-foreground">Quality Report: {quality.tableName}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-border bg-muted/20">
                <div className="text-2xl font-semibold text-foreground tabular-nums">{quality.totalRows.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Total Rows</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-muted/20">
                <div className="text-2xl font-semibold text-foreground tabular-nums">{quality.totalColumns}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Columns</div>
              </div>
            </div>
            {quality.missingByColumn.length > 0 && (
              <div className="rounded-md border border-border p-3">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Missing Values</div>
                <div className="space-y-1">
                  {quality.missingByColumn.map(m => (
                    <div key={m.field} className="flex items-center justify-between text-[12px] py-1">
                      <span className="text-foreground/80">{m.field}</span>
                      <span className="text-warning font-medium tabular-nums">{m.count} ({(m.rate * 100).toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeResultTab === 'history' && (
          <div className="space-y-2">
            <h3 className="font-medium text-[13px] text-foreground mb-3">Operation History</h3>
            {operationHistory.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No operations yet</p>
            ) : (
              <div className="space-y-1.5">
                {operationHistory.map(op => (
                  <div key={op.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-[12px] hover:bg-muted/20 transition-colors duration-75">
                    <span className="font-medium capitalize text-foreground">{op.type}</span>
                    <span className="text-muted-foreground">on {op.tableName}</span>
                    <span className="flex-1" />
                    {op.undoable && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]">
                        <Undo2 className="w-3 h-3" />
                        Undo
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {(activeResultTab === 'charts' || activeResultTab === 'merge' || activeResultTab === 'reshape') && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-[13px]">
            Select a table and run an analysis to see results
          </div>
        )}
      </div>
    </div>
  );
};