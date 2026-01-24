import { 
  BarChart3, 
  PieChart, 
  AlertTriangle, 
  GitMerge, 
  Shuffle, 
  History,
  Copy,
  Download,
  ExternalLink,
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
      <div className="h-9 flex items-center border-b border-border px-2 gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveResultTab(tab.id)}
            className={cn(
              "h-7 px-2.5 flex items-center gap-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap",
              activeResultTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              <h3 className="font-medium text-sm">Summary: {summary.tableName}</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="w-6 h-6"><Copy className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="w-6 h-6"><Download className="w-3 h-3" /></Button>
              </div>
            </div>
            {summary.numericStats.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium">Numeric Fields</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-muted/30">
                      {['Field', 'Count', 'Mean', 'Std', 'Min', 'P25', 'Median', 'P75', 'Max'].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {summary.numericStats.map(stat => (
                        <tr key={stat.field} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5 font-medium">{stat.field}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.count}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.mean.toFixed(2)}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.std.toFixed(2)}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.min.toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.p25.toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.median.toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.p75.toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-mono">{stat.max.toLocaleString()}</td>
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
            <h3 className="font-medium text-sm">Quality Report: {quality.tableName}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-border">
                <div className="text-2xl font-bold">{quality.totalRows}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div className="p-3 rounded-lg border border-border">
                <div className="text-2xl font-bold">{quality.totalColumns}</div>
                <div className="text-xs text-muted-foreground">Columns</div>
              </div>
            </div>
            {quality.missingByColumn.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-medium mb-2">Missing Values</div>
                {quality.missingByColumn.map(m => (
                  <div key={m.field} className="flex items-center justify-between text-xs py-1">
                    <span>{m.field}</span>
                    <span className="text-warning font-medium">{m.count} ({(m.rate * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeResultTab === 'history' && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm mb-3">Operation History</h3>
            {operationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No operations yet</p>
            ) : (
              operationHistory.map(op => (
                <div key={op.id} className="flex items-center gap-2 p-2 rounded border border-border text-xs">
                  <span className="font-medium capitalize">{op.type}</span>
                  <span className="text-muted-foreground">on {op.tableName}</span>
                  <span className="flex-1" />
                  {op.undoable && <Button variant="ghost" size="sm" className="h-6 text-xs"><Undo2 className="w-3 h-3 mr-1" />Undo</Button>}
                </div>
              ))
            )}
          </div>
        )}
        
        {(activeResultTab === 'charts' || activeResultTab === 'merge' || activeResultTab === 'reshape') && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Select a table and run an analysis to see results
          </div>
        )}
      </div>
    </div>
  );
};
