import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export const ChartsView = () => {
  const {
    tables,
    activeTableId,
    activeResultTab,
    chartsByTableId,
    chartsLoadingByTableId,
    chartsErrorByTableId,
    summaryByTableId,
    qualityByTableId,
    fetchSummary,
    fetchQuality,
    fetchCharts,
  } = useAppStore();

  const table = tables.find((t) => t.id === activeTableId);
  const summary = table ? summaryByTableId[table.id] : undefined;
  const quality = table ? qualityByTableId[table.id] : undefined;
  const charts = table ? chartsByTableId[table.id] : undefined;
  const chartsLoading = table ? chartsLoadingByTableId[table.id] : false;
  const chartsError = table ? chartsErrorByTableId[table.id] : undefined;

  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<"histogram" | "bar" | "line">("histogram");
  const [lineXField, setLineXField] = useState<string | null>(null);

  useEffect(() => {
    if (!table) return;
    if (activeResultTab !== "charts") return;
    if (!summary) void fetchSummary(table.id);
    if (!quality) void fetchQuality(table.id);
  }, [table, activeResultTab, summary, quality, fetchSummary, fetchQuality]);

  const numericFields = useMemo(() => {
    if (!summary) return [];
    return summary.numericStats.map((s) => s.field);
  }, [summary]);

  const categoricalFields = useMemo(() => {
    if (!table) return [];
    // Prefer string-ish columns
    return table.fields
      .filter((f) => ["varchar", "text", "string"].includes(String(f.type)))
      .map((f) => f.name);
  }, [table]);

  const lineXFields = useMemo(() => {
    if (!table) return [];
    // Prefer temporal-ish and categorical axes
    return table.fields
      .filter((f) => ["date", "timestamp", "timestamptz", "varchar", "text", "string", "int8", "int4"].includes(String(f.type)))
      .map((f) => f.name);
  }, [table]);

  useEffect(() => {
    if (!selectedField && numericFields.length > 0) {
      setSelectedField(numericFields[0]);
    }
  }, [numericFields, selectedField]);

  useEffect(() => {
    if (!lineXField && lineXFields.length > 0) {
      // Prefer date-like if present
      const prefer = lineXFields.find((f) => f.toLowerCase().includes("date"));
      setLineXField(prefer ?? lineXFields[0]);
    }
  }, [lineXFields, lineXField]);

  const bins = charts?.data?.bins as { x0: number; x1: number; count: number }[] | undefined;
  const histogramData = useMemo(() => {
    if (!bins) return [];
    return bins.map((b) => ({
      bucket: `${Number(b.x0).toFixed(1)}–${Number(b.x1).toFixed(1)}`,
      count: b.count,
    }));
  }, [bins]);

  const barValues = charts?.data?.values as { value: string; count: number }[] | undefined;
  const barData = useMemo(() => {
    if (!barValues) return [];
    return barValues.map((v) => ({ label: String(v.value), count: Number(v.count) }));
  }, [barValues]);

  const linePoints = charts?.data?.points as { x: any; y: number }[] | undefined;
  const lineData = useMemo(() => {
    if (!linePoints) return [];
    return linePoints.map((p) => ({ x: p.x, y: Number(p.y) }));
  }, [linePoints]);

  if (!table) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-[13px]">
        Upload a dataset and select a table to view charts
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-foreground">Charts: {table.name}</div>
        <div className="flex items-center gap-2">
          <select
            className="h-7 rounded-md border border-border bg-background px-2 text-[12px]"
            value={chartKind}
            onChange={(e) => setChartKind(e.target.value as any)}
            title="Chart type"
          >
            <option value="histogram">Histogram</option>
            <option value="bar">Bar (Top)</option>
            <option value="line">Line</option>
          </select>

          {chartKind === "histogram" && (
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-[12px]"
              value={selectedField ?? ""}
              onChange={(e) => setSelectedField(e.target.value)}
              disabled={numericFields.length === 0}
              title="Numeric field"
            >
              {numericFields.length === 0 ? (
                <option value="">No numeric fields</option>
              ) : (
                numericFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          )}

          {chartKind === "bar" && (
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-[12px]"
              value={selectedField ?? ""}
              onChange={(e) => setSelectedField(e.target.value)}
              disabled={categoricalFields.length === 0}
              title="Category field"
            >
              {categoricalFields.length === 0 ? (
                <option value="">No categorical fields</option>
              ) : (
                categoricalFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          )}

          {chartKind === "line" && (
            <select
              className="h-7 rounded-md border border-border bg-background px-2 text-[12px]"
              value={lineXField ?? ""}
              onChange={(e) => setLineXField(e.target.value)}
              disabled={lineXFields.length === 0}
              title="X field"
            >
              {lineXFields.length === 0 ? (
                <option value="">No usable X fields</option>
              ) : (
                lineXFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          )}

          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[12px]"
            disabled={!quality}
            onClick={() => {
              // Missingness renders from Quality report.
            }}
            title="Renders from Quality report"
          >
            Missingness
          </Button>

          <Button
            size="sm"
            className="h-7 text-[12px]"
            disabled={chartsLoading || (chartKind === "histogram" && !selectedField) || (chartKind === "bar" && !selectedField) || (chartKind === "line" && !lineXField)}
            onClick={() => {
              if (chartKind === "histogram") void fetchCharts(table.id, { kind: "histogram", field: selectedField ?? undefined });
              if (chartKind === "bar") void fetchCharts(table.id, { kind: "bar", field: selectedField ?? undefined });
              if (chartKind === "line") void fetchCharts(table.id, { kind: "line", field: lineXField ?? undefined });
            }}
          >
            {chartsLoading ? "Loading…" : "Run"}
          </Button>
        </div>
      </div>

      {/* Missingness heatmap (always shown when quality is available) */}
      {quality ? (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[12px] font-medium text-foreground mb-2">Missingness (by column)</div>
          {quality.missingByColumn?.length ? (
            <div className="grid grid-cols-1 gap-1">
              {quality.missingByColumn.slice(0, 30).map((m: any) => {
                const rate = clamp01(Number(m.rate ?? 0));
                const bg = `rgba(239, 68, 68, ${0.08 + 0.6 * rate})`; // red-500
                return (
                  <div key={m.field} className="flex items-center gap-2">
                    <div className="w-44 text-[11px] text-muted-foreground truncate" title={m.field}>{m.field}</div>
                    <div className="flex-1 h-4 rounded-sm border border-border" style={{ background: bg }} />
                    <div className="w-20 text-[11px] text-muted-foreground tabular-nums text-right">{(rate * 100).toFixed(1)}%</div>
                  </div>
                );
              })}
              {quality.missingByColumn.length > 30 ? (
                <div className="text-[11px] text-muted-foreground mt-1">Showing first 30 columns</div>
              ) : null}
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">No missing values detected.</div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground">
          Loading quality report…
        </div>
      )}

      {/* Chart renderer */}
      {chartsError ? (
        <div className="h-40 flex items-center justify-center text-red-300 text-[13px] border border-dashed border-border rounded-md">
          Chart failed: {chartsError}
        </div>
      ) : !charts ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
          Click Run to generate a chart
        </div>
      ) : chartKind === "histogram" ? (
        !histogramData.length ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
            No histogram data
          </div>
        ) : (
          <div className="h-56 rounded-md border border-border bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={Math.ceil(histogramData.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      ) : chartKind === "bar" ? (
        !barData.length ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
            No bar data
          </div>
        ) : (
          <div className="h-56 rounded-md border border-border bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        // line
        !lineData.length ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
            No line data
          </div>
        ) : (
          <div className="h-56 rounded-md border border-border bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="y" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      )}

      <div className="text-[11px] text-muted-foreground">
        Note: DataPrism requires user-uploaded/imported data. Demo seeding is disabled.
      </div>
    </div>
  );
};
