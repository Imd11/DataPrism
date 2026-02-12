import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const ChartsView = () => {
  const {
    tables,
    activeTableId,
    activeResultTab,
    chartsByTableId,
    chartsLoadingByTableId,
    chartsErrorByTableId,
    summaryByTableId,
    fetchSummary,
    fetchCharts,
  } = useAppStore();

  const table = tables.find((t) => t.id === activeTableId);
  const summary = table ? summaryByTableId[table.id] : undefined;
  const charts = table ? chartsByTableId[table.id] : undefined;
  const chartsLoading = table ? chartsLoadingByTableId[table.id] : false;
  const chartsError = table ? chartsErrorByTableId[table.id] : undefined;

  const [selectedField, setSelectedField] = useState<string | null>(null);

  useEffect(() => {
    if (!table) return;
    if (activeResultTab !== "charts") return;
    if (!summary) void fetchSummary(table.id);
  }, [table, activeResultTab, summary, fetchSummary]);

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
            className="h-7 text-[12px]"
            disabled={!selectedField || chartsLoading}
            onClick={() => void fetchCharts(table.id, { kind: "histogram", field: selectedField ?? undefined })}
          >
            {chartsLoading ? "Loading…" : "Histogram"}
          </Button>
        </div>
      </div>

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
