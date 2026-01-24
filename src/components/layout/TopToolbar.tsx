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
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export const TopToolbar = () => {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed,
    projects,
    currentProjectId,
    setCurrentProject,
    operationHistory,
    undoLastOperation
  } = useAppStore();
  
  const [isDark, setIsDark] = useState(false);
  const currentProject = projects.find(p => p.id === currentProjectId);
  
  const canUndo = operationHistory.some(op => op.undoable);
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);
  
  return (
    <div className="h-11 bg-background border-b border-border flex items-center px-2 gap-1">
      {/* Sidebar Toggle */}
      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
          onClick={() => setSidebarCollapsed(false)}
        >
          <Menu className="w-4 h-4" />
        </Button>
      )}
      
      {/* Left Section - Actions */}
      <div className="flex items-center gap-0.5">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 notion-popover-shadow">
            <DropdownMenuItem className="py-2">
              Export as .dta (Stata)
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2">
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
            "w-7 h-7 hover:bg-foreground/[0.06]",
            canUndo ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30"
          )}
          disabled={!canUndo}
          onClick={undoLastOperation}
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
                onClick={() => setCurrentProject(project.id)}
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
        >
          <Search className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
          onClick={() => setIsDark(!isDark)}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};