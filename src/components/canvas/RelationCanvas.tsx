import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppStore } from '@/stores/appStore';
import { Table2, Key, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TableNode = ({ data, selected }: { data: { label: string; fields: string[]; rowCount: number; isDerived: boolean }; selected: boolean }) => {
  return (
    <div className={cn(
      "min-w-[180px] rounded-lg border-2 bg-canvas-node shadow-sm transition-all",
      selected ? "border-primary shadow-md" : "border-canvas-node-border",
      data.isDerived && "border-dashed"
    )}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-primary !border-0" />
      <div className="px-3 py-2 border-b border-canvas-node-border flex items-center gap-2">
        <Table2 className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">{data.label}</span>
        {data.isDerived && <span className="text-[10px] px-1 py-0.5 rounded bg-warning/20 text-warning">derived</span>}
      </div>
      <div className="px-3 py-2 space-y-1">
        {data.fields.slice(0, 4).map(field => (
          <div key={field} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Key className="w-3 h-3" />
            <span>{field}</span>
          </div>
        ))}
        {data.fields.length > 4 && (
          <div className="text-xs text-muted-foreground/60">+{data.fields.length - 4} more</div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-canvas-node-border text-xs text-muted-foreground">
        {data.rowCount.toLocaleString()} rows
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-primary !border-0" />
    </div>
  );
};

const nodeTypes = { tableNode: TableNode };

export const RelationCanvas = () => {
  const { tables, relations, lineages, selectedNodeId, setSelectedNode, setActiveTable, openTable } = useAppStore();
  
  const initialNodes: Node[] = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {
      'table-companies': { x: 50, y: 50 },
      'table-financials': { x: 50, y: 280 },
      'table-customers': { x: 350, y: 50 },
      'table-orders': { x: 350, y: 280 },
      'table-panel': { x: 300, y: 165 },
    };
    
    return tables.map(table => ({
      id: table.id,
      type: 'tableNode',
      position: positions[table.id] || { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: table.name,
        fields: table.fields.map(f => f.name),
        rowCount: table.rowCount,
        isDerived: table.sourceType === 'derived',
      },
    }));
  }, [tables]);
  
  const initialEdges: Edge[] = useMemo(() => {
    const relEdges = relations.map(rel => ({
      id: rel.id,
      source: rel.pkTableId,
      target: rel.fkTableId,
      label: rel.cardinality,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: 'hsl(221, 83%, 53%)' },
      labelStyle: { fontSize: 10, fill: 'hsl(221, 83%, 53%)' },
    }));
    
    const linEdges = lineages.map(lin => ({
      id: lin.id,
      source: lin.sourceTableIds[0],
      target: lin.derivedTableId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(38, 92%, 50%)', strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(38, 92%, 50%)' },
    }));
    
    return [...relEdges, ...linEdges];
  }, [relations, lineages]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    openTable(node.id);
    setActiveTable(node.id);
  }, [setSelectedNode, openTable, setActiveTable]);
  
  return (
    <div className="h-full w-full bg-canvas-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-canvas-background"
      >
        <Background color="hsl(var(--canvas-grid))" gap={20} />
        <Controls className="!bg-background !border-border !shadow-sm" />
        <MiniMap className="!bg-background !border-border" nodeColor="hsl(var(--muted))" />
      </ReactFlow>
    </div>
  );
};
