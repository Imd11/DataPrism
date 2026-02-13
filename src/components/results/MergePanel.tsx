import { useState, useMemo, useEffect } from 'react';
import { GitMerge, ArrowRight, CheckCircle2, AlertCircle, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';

type JoinType = '1:1' | '1:m' | 'm:1';
type HowType = 'full' | 'left' | 'right' | 'inner';

const howOptions: { value: HowType; label: string; desc: string }[] = [
    { value: 'inner', label: 'Inner', desc: '仅保留匹配行' },
    { value: 'left', label: 'Left', desc: '保留左表所有行' },
    { value: 'right', label: 'Right', desc: '保留右表所有行' },
    { value: 'full', label: 'Full', desc: '保留两侧所有行' },
];

const joinTypeOptions: { value: JoinType; label: string }[] = [
    { value: '1:1', label: '1 : 1' },
    { value: '1:m', label: '1 : M' },
    { value: 'm:1', label: 'M : 1' },
];

export const MergePanel = () => {
    const { tables, relations, selectedRelationId, activeTableId, mergeTables, loading } = useAppStore();

    const [how, setHow] = useState<HowType>('full');
    const [report, setReport] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Manual mode state
    const [leftTableId, setLeftTableId] = useState<string>(activeTableId ?? '');
    const [rightTableId, setRightTableId] = useState<string>('');
    const [leftKey, setLeftKey] = useState<string>('');
    const [rightKey, setRightKey] = useState<string>('');
    const [joinType, setJoinType] = useState<JoinType>('1:1');

    // Auto-fill mode: find the selected relation
    const selectedRelation = useMemo(
        () => relations.find(r => r.id === selectedRelationId) ?? null,
        [relations, selectedRelationId]
    );

    const isAutoMode = !!selectedRelation;

    // Reset report when relation selection changes
    useEffect(() => {
        setReport(null);
        setError(null);
    }, [selectedRelationId]);

    // Auto-mode: resolve table names
    const pkTable = useMemo(() => tables.find(t => t.id === selectedRelation?.pkTableId), [tables, selectedRelation]);
    const fkTable = useMemo(() => tables.find(t => t.id === selectedRelation?.fkTableId), [tables, selectedRelation]);

    // Manual-mode helpers
    const leftTable = useMemo(() => tables.find(t => t.id === leftTableId), [tables, leftTableId]);
    const rightTable = useMemo(() => tables.find(t => t.id === rightTableId), [tables, rightTableId]);
    const rightTableChoices = useMemo(() => tables.filter(t => t.id !== leftTableId), [tables, leftTableId]);
    const leftFields = leftTable?.fields.map(f => f.name) ?? [];
    const rightFields = rightTable?.fields.map(f => f.name) ?? [];

    const canMerge = isAutoMode
        ? (selectedRelation && pkTable && fkTable && !loading)
        : (leftTableId && rightTableId && leftKey && rightKey && !loading);

    const handleMerge = async () => {
        setError(null);
        setReport(null);
        try {
            let res;
            if (isAutoMode && selectedRelation) {
                res = await mergeTables({
                    leftTableId: selectedRelation.pkTableId,
                    rightTableId: selectedRelation.fkTableId,
                    leftKeys: selectedRelation.pkFields,
                    rightKeys: selectedRelation.fkFields,
                    joinType: selectedRelation.cardinality,
                    how,
                });
            } else {
                res = await mergeTables({
                    leftTableId,
                    rightTableId,
                    leftKeys: [leftKey],
                    rightKeys: [rightKey],
                    joinType,
                    how,
                });
            }
            setReport(res?.report ?? res);
        } catch (e: any) {
            setError(e?.message ?? '合并失败');
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-[13px] text-foreground flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5" />
                合并表
            </h3>

            {/* Auto-fill info when relation is selected */}
            {isAutoMode && (
                <div className="rounded-md border border-blue-500/30 p-3 space-y-2.5 bg-blue-500/5">
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-500 font-medium">
                        <MousePointerClick className="w-3 h-3" />
                        已从 Canvas 关系线自动填充
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                        <span className="font-medium text-foreground">{pkTable?.name ?? '—'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{fkTable?.name ?? '—'}</span>
                        <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/60 font-mono">
                            {selectedRelation!.cardinality}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <span className="font-mono bg-muted/40 px-1.5 py-0.5 rounded text-foreground/70">
                            {selectedRelation!.pkFields.join(', ')}
                        </span>
                        <span>=</span>
                        <span className="font-mono bg-muted/40 px-1.5 py-0.5 rounded text-foreground/70">
                            {selectedRelation!.fkFields.join(', ')}
                        </span>
                    </div>
                </div>
            )}

            {/* Manual form when no relation selected */}
            {!isAutoMode && (
                <>
                    {/* Table selectors */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                        <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">左表</label>
                            <select
                                className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={leftTableId}
                                onChange={e => { setLeftTableId(e.target.value); setLeftKey(''); }}
                            >
                                <option value="">选择表...</option>
                                {tables.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <ArrowRight className="w-4 h-4 text-muted-foreground mb-1" />

                        <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">右表</label>
                            <select
                                className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                value={rightTableId}
                                onChange={e => { setRightTableId(e.target.value); setRightKey(''); }}
                            >
                                <option value="">选择表...</option>
                                {rightTableChoices.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Key selectors */}
                    {leftTable && rightTable && (
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                            <div className="space-y-1">
                                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">左表关联字段</label>
                                <select
                                    className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={leftKey}
                                    onChange={e => setLeftKey(e.target.value)}
                                >
                                    <option value="">选择字段...</option>
                                    {leftFields.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>

                            <span className="text-[11px] text-muted-foreground mb-1.5">=</span>

                            <div className="space-y-1">
                                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">右表关联字段</label>
                                <select
                                    className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={rightKey}
                                    onChange={e => setRightKey(e.target.value)}
                                >
                                    <option value="">选择字段...</option>
                                    {rightFields.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Join type */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">关系类型</label>
                        <div className="flex gap-1">
                            {joinTypeOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setJoinType(opt.value)}
                                    className={cn(
                                        "flex-1 h-7 text-[12px] font-medium rounded-md border transition-colors duration-75",
                                        joinType === opt.value
                                            ? "bg-foreground text-background border-foreground"
                                            : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Join method selector — shared by both modes */}
            <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">合并方式</label>
                <div className="grid grid-cols-4 gap-1">
                    {howOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setHow(opt.value)}
                            className={cn(
                                "h-8 text-[12px] font-medium rounded-md border transition-colors duration-75",
                                how === opt.value
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <p className="text-[11px] text-muted-foreground">{howOptions.find(o => o.value === how)?.desc}</p>
            </div>

            {/* Execute button */}
            <Button
                onClick={handleMerge}
                disabled={!canMerge}
                className="w-full h-8 text-[13px] font-medium gap-1.5"
            >
                <GitMerge className="w-3.5 h-3.5" />
                {loading ? '合并中...' : '执行合并'}
            </Button>

            {/* Tip for manual mode */}
            {!isAutoMode && (
                <p className="text-[11px] text-muted-foreground/60 text-center">
                    💡 也可以在 Canvas 上点击关系线自动填充
                </p>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-[12px] text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            {/* Merge report */}
            {report && (
                <div className="rounded-md border border-border overflow-hidden">
                    <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        合并完成
                    </div>
                    <div className="p-3 space-y-2 text-[12px]">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded bg-muted/20 text-center">
                                <div className="text-lg font-semibold text-foreground tabular-nums">{report.matchedRows?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">匹配行</div>
                            </div>
                            <div className="p-2 rounded bg-muted/20 text-center">
                                <div className="text-lg font-semibold text-foreground tabular-nums">{report.unmatchedLeft?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">仅左表</div>
                            </div>
                            <div className="p-2 rounded bg-muted/20 text-center">
                                <div className="text-lg font-semibold text-foreground tabular-nums">{report.unmatchedRight?.toLocaleString()}</div>
                                <div className="text-[10px] text-muted-foreground">仅右表</div>
                            </div>
                        </div>
                        <div className="flex justify-between text-muted-foreground pt-1 border-t border-border">
                            <span>合并前: 左 {report.rowsBefore?.left?.toLocaleString()} 行 / 右 {report.rowsBefore?.right?.toLocaleString()} 行</span>
                            <span className="font-medium text-foreground">合并后: {report.rowsAfter?.toLocaleString()} 行</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
