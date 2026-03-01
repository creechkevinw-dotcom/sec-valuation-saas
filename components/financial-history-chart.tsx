type Row = {
  year: number;
  revenue: number;
  fcf: number;
};

export function FinancialHistoryChart({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Revenue Trend (5Y)</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.year} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{row.year}</span>
              <span>${(row.revenue / 1_000_000_000).toFixed(2)}B</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                style={{ width: `${Math.max(4, (row.revenue / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
