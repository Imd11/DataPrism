import { useCallback, useEffect, useMemo } from 'react';
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
    return <Fingerprint className="w-3 h-3 text-cyan-600 flex-shrink-0" />;
  }
  if (field.isForeignKey) {
    return <Link2 className="w-3 h-3 text-rose-500 flex-shrink-0" />;
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
      selected ? "border-foreground/50 ring-2 ring-foreground/10" : "border-canvas-node-border",
      data.isDerived && "border-dashed border-warning/50"
    )}>
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
      
      {/* Fields with individual handles */}
      <div className="divide-y divide-canvas-node-border/50">
        {data.fields.map((field, idx) => (
          <div 
            key={`${field.name}-${idx}`}
            className={cn(
              "px-3 py-1.5 flex items-center text-xs hover:bg-muted/20 transition-colors relative",
              field.isPrimaryKey && "bg-amber-500/5"
            )}
          >
            {/* Left handle - invisible, only for edge connections */}
            <Handle 
              type="target" 
              position={Position.Left}
              id={`${field.name}-left`}
              className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
              style={{ top: '50%', left: 0, opacity: 0 }}
            />
            
            {/* Icons container - fixed width columns for alignment */}
            <div className="flex items-center gap-0">
              {/* Column 1: Nullable indicator - always first for alignment */}
              <div className="w-4 flex items-center justify-center flex-shrink-0">
                <NullableIcon nullable={field.nullable} />
              </div>
              {/* Column 2: Constraint icon (PK/FK/Unique/Identity) */}
              <div className="w-4 flex items-center justify-center flex-shrink-0">
                <FieldIcon field={field} />
              </div>
            </div>
            
            {/* Field name */}
            <span className={cn(
              "flex-1 truncate ml-2",
              field.isPrimaryKey ? "text-foreground font-medium" : "text-foreground/80"
            )}>
              {field.name}
            </span>
            
            {/* Type */}
            <span className="text-muted-foreground text-[11px] font-mono">
              {getTypeLabel(field.type)}
            </span>
            
            {/* Right handle - invisible, only for edge connections */}
            <Handle 
              type="source" 
              position={Position.Right}
              id={`${field.name}-right`}
              className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
              style={{ top: '50%', right: 0, opacity: 0 }}
            />
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-canvas-node-border bg-muted/20 text-[10px] text-muted-foreground">
        {data.rowCount.toLocaleString()} rows
      </div>
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
        <Fingerprint className="w-3.5 h-3.5 text-cyan-600" />
        <span className="text-muted-foreground">Unique</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <Link2 className="w-3.5 h-3.5 text-rose-500" />
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

const displayCardinality = (c: '1:1' | '1:m' | 'm:1') => {
  // Backend stores cardinality in FK → PK direction.
  // UI displays it as PK → FK (more intuitive: "products 1:m order_items").
  if (c === 'm:1') return '1:M';
  if (c === '1:m') return 'M:1';
  return '1:1';
};

export const RelationCanvas = () => {
  const {
    tables,
    relations,
    lineages,
    setSelectedRelation,
    setSelectedNode,
    setActiveTable,
    openTable,
  } = useAppStore();
  
  // Show all tables in current project (loaded from backend canvas API).
  const canvasTables = useMemo(() => tables, [tables]);
  
  const initialNodes: Node[] = useMemo(() => {
    // Dynamic positioning based on number of tables
    const cols = Math.max(1, Math.ceil(Math.sqrt(canvasTables.length)));
    const nodeWidth = 300;
    const nodeHeight = 280;
    const gapX = 100;
    const gapY = 80;
    
    return canvasTables.map((table, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      
      return {
        id: table.id,
        type: 'tableNode',
        position: { 
          x: 50 + col * (nodeWidth + gapX), 
          y: 50 + row * (nodeHeight + gapY) 
        },
        data: {
          label: table.name,
          fields: table.fields,
          rowCount: table.rowCount,
          isDerived: table.sourceType === 'derived',
        },
      };
    });
  }, [canvasTables]);
  
  const initialEdges: Edge[] = useMemo(() => {
    const ids = new Set(canvasTables.map((t) => t.id));
    
    // Backend relations (PK/FK) - connect PK field to FK field.
    const relEdges: Edge[] = relations
      .filter((r) => ids.has(r.fkTableId) && ids.has(r.pkTableId))
      .map((rel) => {
        const fkField = rel.fkFields[0];
        const pkField = rel.pkFields[0];
        return {
          id: rel.id,
          source: rel.pkTableId,
          target: rel.fkTableId,
          sourceHandle: pkField ? `${pkField}-right` : undefined,
          targetHandle: fkField ? `${fkField}-left` : undefined,
          label: displayCardinality(rel.cardinality),
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: { 
            stroke: 'hsl(var(--foreground) / 0.4)', 
            strokeWidth: 1.5,
            opacity: 0.75,
          },
          labelStyle: { 
            fontSize: 11, 
            fill: 'hsl(var(--foreground))', 
            fontWeight: 600,
            letterSpacing: '0.5px',
          },
          labelBgStyle: { 
            fill: 'hsl(var(--background))', 
            fillOpacity: 0.95,
            rx: 4,
            ry: 4,
          },
          labelBgPadding: [6, 4] as [number, number],
        };
      });
    
    // Lineage edges - orange animated lines for derived tables
    const linEdges: Edge[] = lineages
      .flatMap((lin) =>
        lin.sourceTableIds
          .filter((srcId) => ids.has(srcId) && ids.has(lin.derivedTableId))
          .map((srcId) => ({
            id: `${lin.id}:${srcId}`,
            source: srcId,
            target: lin.derivedTableId,
            type: 'smoothstep',
            animated: true,
            style: {
              stroke: 'hsl(38, 92%, 50%)',
              strokeWidth: 1.5,
              opacity: 0.7,
              strokeDasharray: '6 4',
            },
          })),
      );
    
    return [...relEdges, ...linEdges];
  }, [relations, lineages, canvasTables]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Keep nodes/edges in sync when tables/relations change (e.g. import).
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return initialNodes.map((n) => {
        const existing = prevById.get(n.id);
        return existing
          ? { ...n, position: existing.position, positionAbsolute: (existing as any).positionAbsolute }
          : n;
      });
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    void openTable(node.id);
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
        onEdgeClick={(event, edge) => {
          // Only backend relations have report endpoints.
          if (edge.id.startsWith('rel-')) {
            setSelectedRelation(edge.id);
          }
        }}
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
