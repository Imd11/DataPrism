import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight,
  FolderOpen, 
  Plus,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Pencil,
  Upload,
  Download,
  FileSpreadsheet,
  Table2,
  FolderPlus,
  Copy,
  Settings,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewProjectDialog } from '@/components/projects/NewProjectDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProjectItemProps {
  project: {
    id: string;
    name: string;
    tags: string[];
  };
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onImport: (projectId: string, file: File) => void;
  children: React.ReactNode;
}

const ProjectItem = ({ project, isActive, isExpanded, onToggle, onSelect, onImport, children }: ProjectItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  return (
    <div className="mb-1">
      {/* Project Header */}
      <div 
        className={cn(
          "group flex items-center gap-1 px-2 py-[6px] mx-1 rounded-sm text-[13px] cursor-pointer transition-colors duration-75",
          isActive 
            ? "bg-foreground/[0.06] text-foreground" 
            : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onSelect}
      >
        {/* Icon area - shows chevron on hover */}
        <button
          className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-foreground/[0.08] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isHovered ? (
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-150",
              isExpanded && "rotate-180"
            )} />
          ) : (
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/60" />
          )}
        </button>
        
        {/* Project name */}
        <span className="flex-1 truncate font-medium">{project.name}</span>
        
        {/* Dataset count instead of tags */}
        {!isHovered && (
          <span className="text-[11px] text-muted-foreground/40 tabular-nums">
            {/* Will show dataset count once we have per-project filtering */}
          </span>
        )}
        
        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "p-0.5 rounded-sm transition-opacity duration-75",
                "hover:bg-foreground/[0.08]",
                isHovered ? "opacity-100" : "opacity-0"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 notion-popover-shadow">
            <DropdownMenuItem
              className="gap-2.5 py-2"
              onSelect={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span>Import data…</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 py-2" disabled>
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>Export Project</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2" disabled>
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span>Duplicate Project</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 py-2" disabled>
              <Share2 className="w-4 h-4 text-muted-foreground" />
              <span>Share</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2" disabled>
              <Settings className="w-4 h-4 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 py-2" disabled>
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2.5 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
              disabled
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onImport(project.id, f);
            e.currentTarget.value = "";
          }}
        />
      </div>
      
      {/* Datasets (children) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ml-3 pl-2 border-l border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface DatasetItemProps {
  table: {
    id: string;
    name: string;
    rowCount: number;
    dirty: boolean;
  };
  isActive: boolean;
  isOpen: boolean;
  onClick: () => void;
}

const DatasetItem = ({ table, isActive, isOpen, onClick }: DatasetItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div 
      className={cn(
        "group flex items-center gap-2 px-2 py-[5px] rounded-sm text-[13px] cursor-pointer transition-colors duration-75",
        isActive 
          ? "bg-foreground/[0.06] text-foreground" 
          : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Table2 className={cn(
        "w-3.5 h-3.5 flex-shrink-0",
        isOpen ? "text-foreground/70" : "text-muted-foreground/50"
      )} />
      <span className="flex-1 truncate">{table.name}</span>
      
      {/* Only show dirty indicator (modified) - orange dot */}
      {table.dirty && (
        <span 
          className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" 
          title="Modified - unsaved changes"
        />
      )}
      
      {!isHovered && (
        <span className="text-[11px] text-muted-foreground/40 tabular-nums flex-shrink-0">
          {table.rowCount.toLocaleString()}
        </span>
      )}
      
      {isHovered && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="p-0.5 rounded-sm hover:bg-foreground/[0.08] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 notion-popover-shadow">
            <DropdownMenuItem className="gap-2.5 py-2">
              <Download className="w-4 h-4 text-muted-foreground" />
              <span>Export</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2">
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span>Duplicate</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 py-2">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2.5 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export const AppSidebar = () => {
  const { 
    sidebarCollapsed, 
    setSidebarCollapsed,
    projects,
    currentProjectId,
    setCurrentProject,
    createProject,
    tables,
    openTable,
    activeTableId,
    openTableIds,
    importDatasetToProject,
    importDatasetAsNewProject,
  } = useAppStore();
  
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(currentProjectId ? [currentProjectId] : [])
  );
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  
  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };
  
  const handleSelectProject = (projectId: string) => {
    void setCurrentProject(projectId);
    // Auto-expand when selecting
    setExpandedProjects(prev => new Set(prev).add(projectId));
  };
  
  if (sidebarCollapsed) {
    return (
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: 44 }}
        className="h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3"
      >
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
          onClick={() => setSidebarCollapsed(false)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col items-center gap-0.5 mt-4">
          {projects.map(project => (
            <Button
              key={project.id}
              variant="ghost"
              size="icon"
              className={cn(
                "w-7 h-7",
                project.id === currentProjectId 
                  ? "text-foreground bg-foreground/[0.06]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
              )}
              title={project.name}
              onClick={() => {
                void setCurrentProject(project.id);
                setSidebarCollapsed(false);
              }}
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
          ))}
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: 260 }}
      className="h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-foreground/90 flex items-center justify-center">
            <span className="text-background text-[10px] font-semibold">L</span>
          </div>
          <span className="font-medium text-[13px] text-foreground tracking-tight">LinkData</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
          onClick={() => setSidebarCollapsed(true)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Projects with nested Datasets */}
        {projects.map(project => (
          <ProjectItem
            key={project.id}
            project={project}
            isActive={project.id === currentProjectId}
            isExpanded={expandedProjects.has(project.id)}
            onToggle={() => toggleProject(project.id)}
            onSelect={() => handleSelectProject(project.id)}
            onImport={(projectId, file) => void importDatasetToProject(projectId, file)}
          >
            {/* Datasets under this project */}
            {project.id === currentProjectId && tables.map(table => (
              <DatasetItem
                key={table.id}
                table={table}
                isActive={table.id === activeTableId}
                isOpen={openTableIds.includes(table.id)}
                onClick={() => void openTable(table.id)}
              />
            ))}
            
            {/* Quick import for current project */}
            {project.id === currentProjectId && (
              <div className="mt-0.5 space-y-0.5">
                <label className="flex items-center gap-2 px-2 py-[5px] text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/[0.04] rounded-sm w-full transition-colors duration-75 cursor-pointer">
                  <Plus className="w-3 h-3" />
                  <span>Import into this project…</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      void importDatasetToProject(project.id, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>

                <label className="flex items-center gap-2 px-2 py-[5px] text-[12px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/[0.04] rounded-sm w-full transition-colors duration-75 cursor-pointer">
                  <FolderPlus className="w-3 h-3" />
                  <span>Import as new project…</span>
                  <input
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
                </label>
              </div>
            )}
          </ProjectItem>
        ))}
        
        {/* New Project button */}
        <button
          className="flex items-center gap-2 px-3 py-[6px] mx-1 text-[13px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/[0.04] rounded-sm w-[calc(100%-8px)] transition-colors duration-75 mt-1"
          onClick={() => {
            setNewProjectOpen(true);
          }}
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>
      
      {/* Footer */}
      <div className="px-3 py-2 border-t border-sidebar-border text-[11px] text-muted-foreground/40">
        {tables.length} datasets · {projects.length} projects
      </div>
      
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </motion.div>
  );
};
