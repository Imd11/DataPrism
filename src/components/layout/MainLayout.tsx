import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { TopToolbar } from './TopToolbar';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  tableWorkspace: ReactNode;
  resultsPanel: ReactNode;
  canvas: ReactNode;
}

export const MainLayout = ({ tableWorkspace, resultsPanel, canvas }: MainLayoutProps) => {
  const { sidebarCollapsed } = useAppStore();
  
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {/* Top Toolbar */}
      <TopToolbar />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <AppSidebar />
        
        {/* Left Panel (Table + Results) */}
        <div className={cn(
          "flex flex-col transition-all duration-200",
          sidebarCollapsed ? "w-[calc(60%-24px)]" : "w-[calc(60%-130px)]"
        )}>
          {/* Table Workspace - Takes ~60% of left panel */}
          <div className="flex-[6] min-h-0 border-b border-border overflow-hidden">
            {tableWorkspace}
          </div>
          
          {/* Results Panel - Takes ~40% of left panel */}
          <div className="flex-[4] min-h-0 overflow-hidden">
            {resultsPanel}
          </div>
        </div>
        
        {/* Canvas - Right Panel */}
        <div className={cn(
          "flex-1 min-w-[400px] border-l border-border overflow-hidden",
          sidebarCollapsed ? "w-[40%]" : "w-[40%]"
        )}>
          {canvas}
        </div>
      </div>
    </div>
  );
};
