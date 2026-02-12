import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

  useEffect(() => {
    if (!selectedField && numericFields.length > 0) {
      setSelectedField(numericFields[0]);
    }
  }, [numericFields, selectedField]);

  const bins = charts?.data?.bins as { x0: number; x1: number; count: number }[] | undefined;
  const chartData = useMemo(() => {
    if (!bins) return [];
    return bins.map((b) => ({
      bucket: `${Number(b.x0).toFixed(1)}–${Number(b.x1).toFixed(1)}`,
      count: b.count,
    }));
  }, [bins]);

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
            value={selectedField ?? ""}
            onChange={(e) => setSelectedField(e.target.value)}
            disabled={numericFields.length === 0}
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
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[12px]"
            disabled={!quality}
            onClick={() => {
              // No-op; heatmap renders from quality data.
            }}
            title="Renders from Quality report"
          >
            Missingness
          </Button>
          <Button
            size="sm"
            className="h-7 text-[12px]"
            disabled={!selectedField || chartsLoading}
            onClick={() => void fetchCharts(table.id, { kind: "histogram", field: selectedField ?? undefined })}
          >
            {chartsLoading ? "Loading…" : "Histogram"}
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

      {/* Histogram */}
      {chartsError ? (
        <div className="h-40 flex items-center justify-center text-red-300 text-[13px] border border-dashed border-border rounded-md">
          Chart failed: {chartsError}
        </div>
      ) : !charts ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
          Click Histogram to generate a chart
        </div>
      ) : !chartData.length ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-[13px] border border-dashed border-border rounded-md">
          No chart data
        </div>
      ) : (
        <div className="h-56 rounded-md border border-border bg-background">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={Math.ceil(chartData.length / 8)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#a78bfa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">
        Note: DataPrism requires user-uploaded/imported data. Demo seeding is disabled.
      </div>
    </div>
  );
};
