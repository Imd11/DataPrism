import { ReactNode } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
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
        
        {/* Resizable Main Area */}
        <ResizablePanelGroup 
          direction="horizontal" 
          className="flex-1"
        >
          {/* Left Panel (Table + Results) */}
          <ResizablePanel 
            defaultSize={55} 
            minSize={30} 
            maxSize={80}
            className="flex flex-col"
          >
            <ResizablePanelGroup direction="vertical">
              {/* Table Workspace */}
              <ResizablePanel 
                defaultSize={60} 
                minSize={20} 
                maxSize={85}
                className="overflow-hidden"
              >
                {tableWorkspace}
              </ResizablePanel>
              
              {/* Vertical Resize Handle */}
              <ResizableHandle 
                withHandle 
                className="bg-border hover:bg-primary/20 transition-colors data-[resize-handle-active]:bg-primary/30"
              />
              
              {/* Results Panel */}
              <ResizablePanel 
                defaultSize={40} 
                minSize={15} 
                maxSize={80}
                className="overflow-hidden"
              >
                {resultsPanel}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          
          {/* Horizontal Resize Handle */}
          <ResizableHandle 
            withHandle 
            className="bg-border hover:bg-primary/20 transition-colors data-[resize-handle-active]:bg-primary/30"
          />
          
          {/* Canvas - Right Panel */}
          <ResizablePanel 
            defaultSize={45} 
            minSize={25} 
            maxSize={70}
            className="overflow-hidden"
          >
            {canvas}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};
