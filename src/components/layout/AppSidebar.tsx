import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight,
  FolderOpen, 
  Database, 
  Plus,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
  Pencil,
  Upload,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const SidebarSection = ({ title, icon, children, defaultOpen = true }: SidebarSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-hover rounded-md transition-colors"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface SidebarItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  isOpen?: boolean;
  dirty?: boolean;
  meta?: string;
  onClick?: () => void;
  onOpen?: () => void;
  onMenuAction?: (action: string) => void;
}

const SidebarItem = ({ label, icon, active, isOpen, dirty, meta, onClick, onOpen, onMenuAction }: SidebarItemProps) => {
  const [showMenu, setShowMenu] = useState(false);
  
  return (
    <div 
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm cursor-pointer transition-colors",
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-sidebar-foreground hover:bg-sidebar-hover"
      )}
      onClick={onClick}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {icon && <span className="text-sidebar-foreground/60">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-dirty" />}
      {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Open in workspace" />}
      {meta && <span className="text-xs text-sidebar-foreground/40">{meta}</span>}
      
      {onMenuAction && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "p-0.5 rounded hover:bg-sidebar-accent transition-opacity",
                showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {onOpen && (
              <>
                <DropdownMenuItem onClick={() => onOpen()}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onMenuAction('rename')}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onMenuAction('delete')}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
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
    tables,
    openTable,
    activeTableId,
    openTableIds
  } = useAppStore();
  
  const currentProject = projects.find(p => p.id === currentProjectId);
  
  if (sidebarCollapsed) {
    return (
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: 48 }}
        className="h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3"
      >
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-hover"
          onClick={() => setSidebarCollapsed(false)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col items-center gap-1 mt-4">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-hover"
            title="Projects"
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-hover"
            title="Datasets"
          >
            <Database className="w-4 h-4" />
          </Button>
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
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">L</span>
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground">LinkData</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-hover"
          onClick={() => setSidebarCollapsed(true)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Projects Section */}
        <SidebarSection 
          title="Projects" 
          icon={<FolderOpen className="w-4 h-4" />}
        >
          <div className="ml-2">
            {projects.map(project => (
              <SidebarItem
                key={project.id}
                label={project.name}
                active={project.id === currentProjectId}
                onClick={() => setCurrentProject(project.id)}
                onMenuAction={(action) => console.log(action, project.id)}
              />
            ))}
            <button className="flex items-center gap-2 px-3 py-1.5 mx-1 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-hover rounded-md w-full transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </SidebarSection>
        
        {/* Datasets Section */}
        <SidebarSection 
          title="Datasets" 
          icon={<Database className="w-4 h-4" />}
        >
          <div className="ml-2">
            {tables.map(table => (
              <SidebarItem
                key={table.id}
                label={table.name}
                icon={<Database className="w-3.5 h-3.5" />}
                active={table.id === activeTableId}
                isOpen={openTableIds.includes(table.id)}
                dirty={table.dirty}
                meta={`${table.rowCount.toLocaleString()} rows`}
                onClick={() => openTable(table.id)}
                onOpen={() => openTable(table.id)}
                onMenuAction={(action) => console.log(action, table.id)}
              />
            ))}
            <button className="flex items-center gap-2 px-3 py-1.5 mx-1 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-hover rounded-md w-full transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Dataset</span>
            </button>
          </div>
        </SidebarSection>
      </div>
      
      {/* Footer - Current Project Info */}
      {currentProject && (
        <div className="px-3 py-2.5 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/50">
            Current Project
          </div>
          <div className="text-sm font-medium text-sidebar-foreground truncate">
            {currentProject.name}
          </div>
          <div className="flex gap-1 mt-1">
            {currentProject.tags.map(tag => (
              <span 
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
