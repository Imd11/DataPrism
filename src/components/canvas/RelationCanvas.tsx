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
import { Table2, Key, Hash, Fingerprint, Circle, Link2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Field } from '@/types/data';

interface TableNodeData {
  label: string;
  fields: Field[];
  rowCount: number;
  isDerived: boolean;
}

const FieldIcon = ({ field }: { field: Field }) => {
  if (field.isPrimaryKey) {
    return <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />;
  }
  if (field.isIdentity) {
    return <Hash className="w-3 h-3 text-emerald-500 flex-shrink-0" />;
  }
  if (field.isUnique) {
    return <Fingerprint className="w-3 h-3 text-blue-500 flex-shrink-0" />;
  }
  if (field.isForeignKey) {
    return <Link2 className="w-3 h-3 text-purple-500 flex-shrink-0" />;
  }
  return null;
};

const NullableIcon = ({ nullable }: { nullable: boolean }) => {
  if (nullable) {
    return (
      <Circle 
        className="w-2.5 h-2.5 text-muted-foreground/50 flex-shrink-0" 
        strokeWidth={1.5}
      />
    );
  }
  return (
    <Circle 
      className="w-2.5 h-2.5 text-amber-500 fill-amber-500 flex-shrink-0" 
      strokeWidth={0}
    />
  );
};

const getTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    uuid: 'uuid',
    text: 'text',
    varchar: 'varchar',
    int4: 'int4',
    int8: 'int8',
    float8: 'float8',
    boolean: 'bool',
    timestamptz: 'timestamptz',
    timestamp: 'timestamp',
    jsonb: 'jsonb',
    date: 'date',
    string: 'text',
    number: 'int4',
  };
  return typeMap[type] || type;
};

const TableNode = ({ data, selected }: { data: TableNodeData; selected: boolean }) => {
  return (
    <div className={cn(
      "min-w-[240px] max-w-[280px] rounded-md border bg-canvas-node overflow-hidden transition-all",
      selected ? "border-primary ring-2 ring-primary/20" : "border-canvas-node-border",
      data.isDerived && "border-dashed border-warning/50"
    )}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-canvas-node !border-2 !border-primary !-left-1.5" 
      />
      
      {/* Header */}
      <div className="px-3 py-2 border-b border-canvas-node-border bg-muted/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm text-foreground">{data.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {data.isDerived && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
              derived
            </span>
          )}
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground cursor-pointer" />
        </div>
      </div>
      
      {/* Fields */}
      <div className="divide-y divide-canvas-node-border/50">
        {data.fields.map((field, idx) => (
          <div 
            key={`${field.name}-${idx}`}
            className={cn(
              "px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-muted/20 transition-colors",
              field.isPrimaryKey && "bg-amber-500/5"
            )}
          >
            {/* Icons */}
            <div className="flex items-center gap-1 w-8 justify-start">
              <FieldIcon field={field} />
              <NullableIcon nullable={field.nullable} />
            </div>
            
            {/* Field name */}
            <span className={cn(
              "flex-1 truncate",
              field.isPrimaryKey ? "text-foreground font-medium" : "text-foreground/80"
            )}>
              {field.name}
            </span>
            
            {/* Type */}
            <span className="text-muted-foreground text-[11px] font-mono">
              {getTypeLabel(field.type)}
            </span>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-canvas-node-border bg-muted/20 text-[10px] text-muted-foreground">
        {data.rowCount.toLocaleString()} rows
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-canvas-node !border-2 !border-primary !-right-1.5" 
      />
    </div>
  );
};

const nodeTypes = { tableNode: TableNode };

// Canvas Legend Component
const CanvasLegend = () => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 px-4 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-sm z-10">
      <div className="flex items-center gap-1.5 text-xs">
        <Key className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-muted-foreground">Primary key</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Hash className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-muted-foreground">Identity</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Fingerprint className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-muted-foreground">Unique</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Link2 className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-muted-foreground">Foreign key</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Circle className="w-2.5 h-2.5 text-muted-foreground/50" strokeWidth={1.5} />
        <span className="text-muted-foreground">Nullable</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Circle className="w-2.5 h-2.5 text-amber-500 fill-amber-500" strokeWidth={0} />
        <span className="text-muted-foreground">Non-Nullable</span>
      </div>
    </div>
  );
};

export const RelationCanvas = () => {
  const { tables, relations, lineages, selectedNodeId, setSelectedNode, setActiveTable, openTable } = useAppStore();
  
  const initialNodes: Node[] = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {
      'table-companies': { x: 50, y: 50 },
      'table-financials': { x: 400, y: 50 },
      'table-customers': { x: 50, y: 380 },
      'table-orders': { x: 400, y: 380 },
      'table-panel': { x: 750, y: 200 },
    };
    
    return tables.map(table => ({
      id: table.id,
      type: 'tableNode',
      position: positions[table.id] || { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: table.name,
        fields: table.fields,
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
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: 'hsl(var(--primary))', fontWeight: 500 },
      labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.9 },
    }));
    
    const linEdges = lineages.map(lin => ({
      id: lin.id,
      source: lin.sourceTableIds[0],
      target: lin.derivedTableId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(38, 92%, 50%)', strokeDasharray: '5,5', strokeWidth: 2 },
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
    <div className="h-full w-full bg-canvas-background relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-canvas-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--canvas-grid))" gap={24} size={1} />
        <Controls 
          className="!bg-background !border-border !shadow-sm !rounded-lg overflow-hidden" 
          showInteractive={false}
        />
        <MiniMap 
          className="!bg-background/95 !border-border !rounded-lg overflow-hidden" 
          nodeColor="hsl(var(--muted))" 
          maskColor="hsl(var(--background) / 0.8)"
        />
      </ReactFlow>
      <CanvasLegend />
    </div>
  );
};
