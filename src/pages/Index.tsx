import { MainLayout } from '@/components/layout/MainLayout';
import { TableWorkspace } from '@/components/table/TableWorkspace';
import { ResultsPanel } from '@/components/results/ResultsPanel';
import { RelationCanvas } from '@/components/canvas/RelationCanvas';
import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

const Index = () => {
  const bootstrap = useAppStore((s) => s.bootstrap);
  
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  
  return (
    <MainLayout
      tableWorkspace={<TableWorkspace />}
      resultsPanel={<ResultsPanel />}
      canvas={<RelationCanvas />}
    />
  );
};

export default Index;
