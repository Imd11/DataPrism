import { MainLayout } from '@/components/layout/MainLayout';
import { TableWorkspace } from '@/components/table/TableWorkspace';
import { ResultsPanel } from '@/components/results/ResultsPanel';
import { RelationCanvas } from '@/components/canvas/RelationCanvas';

const Index = () => {
  return (
    <MainLayout
      tableWorkspace={<TableWorkspace />}
      resultsPanel={<ResultsPanel />}
      canvas={<RelationCanvas />}
    />
  );
};

export default Index;
