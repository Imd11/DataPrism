import { 
  Menu,
  Upload, 
  Download, 
  Undo2, 
  Redo2, 
  Search, 
  HelpCircle,
  ChevronDown,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/stores/appStore';
import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export const TopToolbar = () => {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed,
    projects,
    currentProjectId,
    setCurrentProject,
    activeTableId,
    operationHistory,
    undoLastOperation,
    exportActiveTable,
    importDataset,
    importDatasetAsNewProject,
    loading,
    error,
  } = useAppStore();

  const importThisRef = useRef<HTMLInputElement | null>(null);
  const importNewProjectRef = useRef<HTMLInputElement | null>(null);

  const [isDark, setIsDark] = useState(false);
  const currentProject = projects.find(p => p.id === currentProjectId);
  
  const canUndo = operationHistory.some(op => op.undoable);
  const canExport = Boolean(activeTableId) && !loading;
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);
  
  return (
    <div className="h-10 bg-background border-b border-border/60 flex items-center px-2 gap-1">
      {/* Sidebar Toggle */}
      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground notion-icon-btn"
          onClick={() => setSidebarCollapsed(false)}
        >
          <Menu className="w-4 h-4" />
        </Button>
      )}
      
      {/* Left Section - Actions */}
      <div className="flex items-center gap-0.5">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
            onClick={() => importThisRef.current?.click()}
            disabled={loading}
            title="Import a dataset"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-muted-foreground hover:text-foreground notion-icon-btn"
                disabled={loading}
                title="Import options"
              >
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 notion-popover-shadow">
              <DropdownMenuItem
                className="py-2"
                onSelect={(e) => {
                  e.preventDefault();
                  importThisRef.current?.click();
                }}
              >
                Import into this project…
              </DropdownMenuItem>
              <DropdownMenuItem
                className="py-2"
                onSelect={(e) => {
                  e.preventDefault();
                  importNewProjectRef.current?.click();
                }}
              >
                Import as new project…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={importThisRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void importDataset(f);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={importNewProjectRef}
            type="file"
            className="hidden"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void importDatasetAsNewProject(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-7 gap-1.5 px-2.5 text-[13px]",
                canExport
                  ? "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                  : "text-muted-foreground/30"
              )}
              disabled={!canExport}
              title={canExport ? "Export the active table" : "Open a table to export"}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 notion-popover-shadow">
            <DropdownMenuItem className="py-2" onClick={() => void exportActiveTable('dta')}>
              Export as .dta (Stata)
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2" onClick={() => void exportActiveTable('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="py-2 text-muted-foreground/50">
              Export as Parquet (coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-px h-4 bg-border mx-1.5" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "w-7 h-7 notion-icon-btn",
            canUndo ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30"
          )}
          disabled={!canUndo}
          title={canUndo ? "Undo" : "Nothing to undo"}
          onClick={() => void undoLastOperation()}
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground/30"
          disabled
        >
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      
      {/* Center - Project Selector */}
      <div className="flex-1 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 gap-1.5 px-2.5 text-[13px] hover:bg-foreground/[0.06]"
            >
              <span className="font-medium text-foreground">{currentProject?.name || 'Select Project'}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 notion-popover-shadow">
            {projects.map(project => (
              <DropdownMenuItem 
                key={project.id}
                onClick={() => void setCurrentProject(project.id)}
                className={cn(
                  "py-2",
                  project.id === currentProjectId && "bg-foreground/[0.04]"
                )}
              >
                {project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-0.5">
        {loading && (
          <span className="text-[12px] text-muted-foreground px-2">Loading…</span>
        )}
        {error && (
          <span className="text-[12px] text-destructive max-w-[320px] truncate px-2" title={error}>
            {error}
          </span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground notion-icon-btn"
        >
          <Search className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground notion-icon-btn"
          onClick={() => setIsDark(!isDark)}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground notion-icon-btn"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
