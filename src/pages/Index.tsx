import { MainLayout } from '@/components/layout/MainLayout';
import { TableWorkspace } from '@/components/table/TableWorkspace';
import { useEffect, Suspense, lazy } from 'react';
import { useAppStore } from '@/stores/appStore';

const LazyResultsPanel = lazy(async () => {
  const mod = await import('@/components/results/ResultsPanel');
  return { default: mod.ResultsPanel };
});

const LazyRelationCanvas = lazy(async () => {
  const mod = await import('@/components/canvas/RelationCanvas');
  return { default: mod.RelationCanvas };
});

const PanelFallback = ({ label }: { label: string }) => (
  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[13px]">
    Loading {label}…
  </div>
);

const Index = () => {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <MainLayout
      tableWorkspace={<TableWorkspace />}
      resultsPanel={
        <Suspense fallback={<PanelFallback label="results" />}>
          <LazyResultsPanel />
        </Suspense>
      }
      canvas={
        <Suspense fallback={<PanelFallback label="canvas" />}>
          <LazyRelationCanvas />
        </Suspense>
      }
    />
  );
};

export default Index;
