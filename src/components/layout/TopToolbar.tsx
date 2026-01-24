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
    <div className="h-12 bg-background border-b border-border flex items-center px-3 gap-2">
      {/* Sidebar Toggle */}
      {sidebarCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          onClick={() => setSidebarCollapsed(false)}
        >
          <Menu className="w-4 h-4" />
        </Button>
      )}
      
      {/* Left Section - Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
          <Upload className="w-4 h-4" />
          <span className="text-sm">Import</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
              <Download className="w-4 h-4" />
              <span className="text-sm">Export</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <span>Export as .dta (Stata)</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <span>Export as CSV</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <span>Export as Parquet (coming soon)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-px h-5 bg-border mx-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          disabled={!canUndo}
          onClick={undoLastOperation}
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          disabled
        >
          <Redo2 className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Center - Project Selector */}
      <div className="flex-1 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-2">
              <span className="font-medium">{currentProject?.name || 'Select Project'}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {projects.map(project => (
              <DropdownMenuItem 
                key={project.id}
                onClick={() => setCurrentProject(project.id)}
              >
                {project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <Search className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          onClick={() => setIsDark(!isDark)}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
