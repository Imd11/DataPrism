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
  ExternalLink,
  Table2
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
    <div className="mb-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground rounded-sm transition-colors duration-75"
      >
        <span className="text-muted-foreground/60">{icon}</span>
        <span className="flex-1 text-left tracking-tight">{title}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-150",
          isOpen && "rotate-180"
        )} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
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
        "group flex items-center gap-2 px-3 py-[6px] mx-1 rounded-sm text-[13px] cursor-pointer transition-colors duration-75",
        active 
          ? "bg-foreground/[0.06] text-foreground" 
          : "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground"
      )}
      onClick={onClick}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {icon && <span className="text-muted-foreground/50">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-dirty" />}
      {isOpen && <span className="w-[5px] h-[5px] rounded-full bg-primary" title="Open in workspace" />}
      {meta && <span className="text-[11px] text-muted-foreground/50 tabular-nums">{meta}</span>}
      
      {onMenuAction && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={cn(
                "p-0.5 rounded-sm transition-opacity duration-75",
                "hover:bg-foreground/[0.08]",
                showMenu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 notion-popover-shadow">
            {onOpen && (
              <>
                <DropdownMenuItem onClick={() => onOpen()} className="gap-2.5 py-2">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onMenuAction('rename')} className="gap-2.5 py-2">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onMenuAction('delete')}
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
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            title="Projects"
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]"
            title="Datasets"
          >
            <Table2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: 240 }}
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
        {/* Projects Section */}
        <SidebarSection 
          title="Projects" 
          icon={<FolderOpen className="w-4 h-4" />}
        >
          <div className="ml-1.5">
            {projects.map(project => (
              <SidebarItem
                key={project.id}
                label={project.name}
                active={project.id === currentProjectId}
                onClick={() => setCurrentProject(project.id)}
                onMenuAction={(action) => console.log(action, project.id)}
              />
            ))}
            <button className="flex items-center gap-2 px-3 py-[6px] mx-1 text-[13px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.04] rounded-sm w-full transition-colors duration-75">
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </SidebarSection>
        
        {/* Datasets Section */}
        <SidebarSection 
          title="Datasets" 
          icon={<Table2 className="w-4 h-4" />}
        >
          <div className="ml-1.5">
            {tables.map(table => (
              <SidebarItem
                key={table.id}
                label={table.name}
                icon={<Table2 className="w-3.5 h-3.5" />}
                active={table.id === activeTableId}
                isOpen={openTableIds.includes(table.id)}
                dirty={table.dirty}
                meta={`${table.rowCount.toLocaleString()}`}
                onClick={() => openTable(table.id)}
                onOpen={() => openTable(table.id)}
                onMenuAction={(action) => console.log(action, table.id)}
              />
            ))}
            <button className="flex items-center gap-2 px-3 py-[6px] mx-1 text-[13px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-foreground/[0.04] rounded-sm w-full transition-colors duration-75">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Dataset</span>
            </button>
          </div>
        </SidebarSection>
      </div>
      
      {/* Footer - Current Project Info */}
      {currentProject && (
        <div className="px-3 py-2 border-t border-sidebar-border">
          <div className="text-[11px] text-muted-foreground/50 uppercase tracking-wide">
            Current Project
          </div>
          <div className="text-[13px] font-medium text-foreground truncate mt-0.5">
            {currentProject.name}
          </div>
          {currentProject.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {currentProject.tags.map(tag => (
                <span 
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-sm bg-foreground/[0.06] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};