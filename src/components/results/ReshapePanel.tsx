import { useState, useMemo, useEffect } from 'react';
import { ArrowRightLeft, CheckCircle2, AlertCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/appStore';
import { Button } from '@/components/ui/button';
import type { Field } from '@/types/data';

type Direction = 'wide-to-long' | 'long-to-wide';

/* ── Shape detection heuristic ───────────────────────────────── */

interface ShapeAnalysis {
    shape: 'wide' | 'long' | 'ambiguous';
    recommendedDirection: Direction;
    reason: string;
    suggestedIdVars: string[];
    suggestedValueVars: string[];
}

/** Returns true if names share a common prefix/suffix pattern like m01,m02,m03 or jan_sales,feb_sales */
function hasNamingPattern(names: string[]): boolean {
    if (names.length < 3) return false;

    // Check numbered suffix pattern: m01, m02, ... or col_1, col_2, ...
    const suffixNums = names.map(n => {
        const m = n.match(/(\d+)$/);
        return m ? parseInt(m[1]) : null;
    });
    if (suffixNums.every(n => n !== null)) return true;

    // Check shared prefix (>= 50% of name length)
    const shortest = Math.min(...names.map(n => n.length));
    let prefixLen = 0;
    for (let i = 0; i < shortest; i++) {
        if (names.every(n => n[i] === names[0][i])) prefixLen++;
        else break;
    }
    if (prefixLen >= 2 && prefixLen >= shortest * 0.4) return true;

    // Check shared suffix
    let suffixLen = 0;
    for (let i = 0; i < shortest; i++) {
        if (names.every(n => n[n.length - 1 - i] === names[0][names[0].length - 1 - i])) suffixLen++;
        else break;
    }
    if (suffixLen >= 2 && suffixLen >= shortest * 0.4) return true;

    return false;
}

const NUMERIC_TYPES = new Set(['int4', 'int8', 'float4', 'float8', 'number', 'double', 'decimal', 'numeric', 'real', 'bigint', 'integer', 'smallint', 'tinyint']);

function analyzeShape(fields: Field[]): ShapeAnalysis {
    // Separate ID-like fields (PK, FK, identity, unique, text/date types) from measure fields
    const idCandidates: string[] = [];
    const measureCandidates: Field[] = [];

    for (const f of fields) {
        if (f.isPrimaryKey || f.isForeignKey || f.isIdentity) {
            idCandidates.push(f.name);
        } else if (NUMERIC_TYPES.has(f.type.toLowerCase())) {
            measureCandidates.push(f);
        } else {
            // text, date, etc. → likely an ID/dimension
            idCandidates.push(f.name);
        }
    }

    const measureNames = measureCandidates.map(f => f.name);

    // Heuristic 1: Many same-type numeric columns with naming pattern → WIDE
    if (measureCandidates.length >= 3 && hasNamingPattern(measureNames)) {
        return {
            shape: 'wide',
            recommendedDirection: 'wide-to-long',
            reason: `检测到 ${measureCandidates.length} 个同类型数值列（${measureNames.slice(0, 3).join(', ')}...），命名有规律，疑似宽格式`,
            suggestedIdVars: idCandidates,
            suggestedValueVars: measureNames,
        };
    }

    // Heuristic 2: More numeric columns than non-numeric (excluding PKs) → likely WIDE
    if (measureCandidates.length >= 4 && measureCandidates.length > idCandidates.length * 2) {
        return {
            shape: 'wide',
            recommendedDirection: 'wide-to-long',
            reason: `数值列(${measureCandidates.length})远多于标识列(${idCandidates.length})，可能是宽格式`,
            suggestedIdVars: idCandidates,
            suggestedValueVars: measureNames,
        };
    }

    // Heuristic 3: Few columns, diverse types → LONG (standard relational table)
    const uniqueTypes = new Set(fields.map(f => f.type.toLowerCase()));
    if (uniqueTypes.size >= Math.ceil(fields.length * 0.5) && fields.length <= 10) {
        return {
            shape: 'long',
            recommendedDirection: 'long-to-wide',
            reason: `列类型多样（${uniqueTypes.size} 种类型 / ${fields.length} 列），是标准长格式表`,
            suggestedIdVars: idCandidates,
            suggestedValueVars: [],
        };
    }

    return {
        shape: 'ambiguous',
        recommendedDirection: 'wide-to-long',
        reason: '无法确定表格形态，请根据数据含义手动选择方向',
        suggestedIdVars: idCandidates,
        suggestedValueVars: [],
    };
}

/* ── Component ───────────────────────────────────────────────── */

export const ReshapePanel = () => {
    const { tables, activeTableId, reshapeTable, loading } = useAppStore();

    const activeTable = useMemo(
        () => tables.find(t => t.id === activeTableId) ?? null,
        [tables, activeTableId]
    );

    // Shape analysis
    const analysis = useMemo(
        () => activeTable ? analyzeShape(activeTable.fields) : null,
        [activeTable]
    );

    const [direction, setDirection] = useState<Direction>('wide-to-long');
    const [idVars, setIdVars] = useState<string[]>([]);
    const [valueVars, setValueVars] = useState<string[]>([]);
    const [variableName, setVariableName] = useState('variable');
    const [valueName, setValueName] = useState('value');
    const [pivotColumns, setPivotColumns] = useState('');
    const [pivotValues, setPivotValues] = useState('');
    const [report, setReport] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Auto-apply analysis when table changes
    useEffect(() => {
        if (!analysis) return;
        setDirection(analysis.recommendedDirection);
        setIdVars(analysis.suggestedIdVars);
        setValueVars(analysis.suggestedValueVars);
        setPivotColumns('');
        setPivotValues('');
        setReport(null);
        setError(null);
    }, [activeTableId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fieldNames = useMemo(
        () => activeTable?.fields.map(f => f.name) ?? [],
        [activeTable]
    );

    const availableValueVars = useMemo(
        () => fieldNames.filter(f => !idVars.includes(f)),
        [fieldNames, idVars]
    );

    // Type consistency check for selected valueVars
    const typeWarning = useMemo(() => {
        if (direction !== 'wide-to-long' || valueVars.length < 2 || !activeTable) return null;
        const selectedFields = activeTable.fields.filter(f => valueVars.includes(f.name));
        const types = new Set(selectedFields.map(f => f.type.toLowerCase()));
        if (types.size > 1) {
            const typeList = Array.from(types).join(', ');
            return `选中的列类型不一致（${typeList}），Melt 后 value 列将统一转为 text，可能不是你想要的结果`;
        }
        return null;
    }, [direction, valueVars, activeTable]);

    const toggleField = (
        field: string,
        list: string[],
        setter: (v: string[]) => void
    ) => {
        if (list.includes(field)) {
            setter(list.filter(f => f !== field));
        } else {
            setter([...list, field]);
        }
    };

    const canReshape = activeTableId && idVars.length > 0 && (
        direction === 'wide-to-long'
            ? valueVars.length > 0
            : pivotColumns && pivotValues
    ) && !loading;

    const handleReshape = async () => {
        if (!activeTableId) return;
        setError(null);
        setReport(null);
        try {
            const input: any = {
                tableId: activeTableId,
                direction,
                idVars,
                valueVars,
            };
            if (direction === 'wide-to-long') {
                input.variableName = variableName || 'variable';
                input.valueName = valueName || 'value';
            } else {
                input.pivotColumns = pivotColumns;
                input.pivotValues = pivotValues;
            }
            const res = await reshapeTable(input);
            setReport(res?.reshapeReport ?? res);
        } catch (e: any) {
            setError(e?.message ?? 'Reshape 失败');
        }
    };

    if (!activeTable) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-[13px]">
                请先选择一张表
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-[13px] text-foreground flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Reshape · {activeTable.name}
            </h3>

            {/* Shape analysis badge */}
            {analysis && (
                <div className={cn(
                    "flex items-start gap-2 p-2.5 rounded-md text-[12px] border",
                    analysis.shape === 'wide'
                        ? "bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400"
                        : analysis.shape === 'long'
                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted/30 border-border text-muted-foreground"
                )}>
                    <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                        <span className="font-medium">
                            {analysis.shape === 'wide' ? '🔵 检测为宽格式' :
                                analysis.shape === 'long' ? '🟢 检测为长格式' : '⚪ 格式不确定'}
                        </span>
                        <span className="ml-1.5 text-[11px] opacity-80">— {analysis.reason}</span>
                    </div>
                </div>
            )}

            {/* Direction toggle */}
            <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">方向</label>
                <div className="grid grid-cols-2 gap-1">
                    <button
                        onClick={() => setDirection('wide-to-long')}
                        className={cn(
                            "h-8 text-[12px] font-medium rounded-md border transition-colors duration-75",
                            direction === 'wide-to-long'
                                ? "bg-foreground text-background border-foreground"
                                : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                        )}
                    >
                        宽 → 长 (Melt)
                    </button>
                    <button
                        onClick={() => setDirection('long-to-wide')}
                        className={cn(
                            "h-8 text-[12px] font-medium rounded-md border transition-colors duration-75",
                            direction === 'long-to-wide'
                                ? "bg-foreground text-background border-foreground"
                                : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                        )}
                    >
                        长 → 宽 (Pivot)
                    </button>
                </div>
            </div>

            {/* Warning when direction mismatches detected shape */}
            {analysis && analysis.shape !== 'ambiguous' && (
                (analysis.shape === 'long' && direction === 'wide-to-long') ||
                (analysis.shape === 'wide' && direction === 'long-to-wide')
            ) && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                            当前表{analysis.shape === 'long' ? '已经是长格式' : '已经是宽格式'}，
                            选择此方向可能产生无意义的结果。确定要继续吗？
                        </span>
                    </div>
                )}

            {/* ID variables selection */}
            <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    标识变量 (ID Vars) — 保持不变的列
                </label>
                <div className="flex flex-wrap gap-1">
                    {fieldNames.map(f => (
                        <button
                            key={f}
                            onClick={() => {
                                toggleField(f, idVars, setIdVars);
                                if (!idVars.includes(f)) {
                                    setValueVars(prev => prev.filter(v => v !== f));
                                }
                            }}
                            className={cn(
                                "px-2 py-1 text-[11px] rounded border transition-colors duration-75",
                                idVars.includes(f)
                                    ? "bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400 font-medium"
                                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Direction-specific fields */}
            {direction === 'wide-to-long' ? (
                <>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                            值变量 (Value Vars) — 被"融化"的列
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {availableValueVars.map(f => {
                                const field = activeTable.fields.find(ff => ff.name === f);
                                const isNumeric = field && NUMERIC_TYPES.has(field.type.toLowerCase());
                                return (
                                    <button
                                        key={f}
                                        onClick={() => toggleField(f, valueVars, setValueVars)}
                                        className={cn(
                                            "px-2 py-1 text-[11px] rounded border transition-colors duration-75",
                                            valueVars.includes(f)
                                                ? "bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400 font-medium"
                                                : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40",
                                            !isNumeric && valueVars.includes(f) && "ring-1 ring-amber-500/50"
                                        )}
                                        title={field ? `${f} (${field.type})` : f}
                                    >
                                        {f}
                                        {!isNumeric && <span className="ml-0.5 text-[9px] opacity-60">abc</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-3">
                            {availableValueVars.length > 0 && valueVars.length < availableValueVars.length && (
                                <button
                                    onClick={() => setValueVars([...availableValueVars])}
                                    className="text-[11px] text-blue-500 hover:underline"
                                >
                                    全选
                                </button>
                            )}
                            {valueVars.length > 0 && (
                                <button
                                    onClick={() => setValueVars([])}
                                    className="text-[11px] text-muted-foreground hover:underline"
                                >
                                    清空
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Type consistency warning */}
                    {typeWarning && (
                        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span>{typeWarning}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">变量列名</label>
                            <input
                                type="text"
                                value={variableName}
                                onChange={e => setVariableName(e.target.value)}
                                placeholder="variable"
                                className="w-full h-7 px-2 text-[12px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">值列名</label>
                            <input
                                type="text"
                                value={valueName}
                                onChange={e => setValueName(e.target.value)}
                                placeholder="value"
                                className="w-full h-7 px-2 text-[12px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                            />
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                            Pivot 列 — 值作为新列名
                        </label>
                        <select
                            className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            value={pivotColumns}
                            onChange={e => setPivotColumns(e.target.value)}
                        >
                            <option value="">选择字段...</option>
                            {availableValueVars.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                            Pivot 值 — 填充新列
                        </label>
                        <select
                            className="w-full h-8 px-2 text-[13px] bg-muted/30 border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            value={pivotValues}
                            onChange={e => setPivotValues(e.target.value)}
                        >
                            <option value="">选择字段...</option>
                            {availableValueVars.filter(f => f !== pivotColumns).map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>
                </>
            )}

            {/* Preview summary */}
            {idVars.length > 0 && (direction === 'wide-to-long' ? valueVars.length > 0 : pivotColumns && pivotValues) && (
                <div className="p-2.5 rounded-md bg-muted/20 border border-border text-[12px] text-muted-foreground space-y-1">
                    {direction === 'wide-to-long' ? (
                        <>
                            <p>保留 <span className="text-blue-500 font-medium">{idVars.join(', ')}</span> 作为标识列</p>
                            <p>将 <span className="text-amber-500 font-medium">{valueVars.length}</span> 列融化为 <span className="font-mono text-foreground/70">{variableName || 'variable'}</span> + <span className="font-mono text-foreground/70">{valueName || 'value'}</span></p>
                            <p className="text-[11px]">预计行数: {activeTable.rowCount} × {valueVars.length} = <span className="font-medium text-foreground">{(activeTable.rowCount * valueVars.length).toLocaleString()}</span></p>
                        </>
                    ) : (
                        <>
                            <p>以 <span className="text-blue-500 font-medium">{idVars.join(', ')}</span> 为行索引</p>
                            <p>用 <span className="font-mono text-foreground/70">{pivotColumns}</span> 的值作为新列名，<span className="font-mono text-foreground/70">{pivotValues}</span> 的值填充</p>
                        </>
                    )}
                </div>
            )}

            <Button
                onClick={handleReshape}
                disabled={!canReshape}
                className="w-full h-8 text-[13px] font-medium gap-1.5"
            >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {loading ? '转换中...' : '执行 Reshape'}
            </Button>

            {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-[12px] text-destructive">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            {report && (
                <div className="rounded-md border border-border overflow-hidden">
                    <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        转换完成
                    </div>
                    <div className="p-3 space-y-2 text-[12px]">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded bg-muted/20 text-center">
                                <div className="text-[10px] text-muted-foreground mb-0.5">转换前</div>
                                <div className="text-sm font-semibold text-foreground tabular-nums">
                                    {report.rowsBefore?.toLocaleString()} 行 × {report.columnsBefore} 列
                                </div>
                            </div>
                            <div className="p-2 rounded bg-muted/20 text-center">
                                <div className="text-[10px] text-muted-foreground mb-0.5">转换后</div>
                                <div className="text-sm font-semibold text-foreground tabular-nums">
                                    {report.rowsAfter?.toLocaleString()} 行 × {report.columnsAfter} 列
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
