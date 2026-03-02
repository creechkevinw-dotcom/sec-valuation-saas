type MonteCarloBin = {
  start: number;
  end: number;
  count: number;
};

type MonteCarloResult = {
  iterations: number;
  successRate: number;
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  min: number;
  max: number;
  histogram: MonteCarloBin[];
};

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function MonteCarloCard({ result }: { result?: MonteCarloResult }) {
  if (!result) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Monte Carlo Distribution</h3>
        <p className="mt-2 text-sm text-slate-500">No Monte Carlo output for this valuation yet.</p>
      </section>
    );
  }

  const maxBin = Math.max(1, ...result.histogram.map((bin) => bin.count));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Monte Carlo Distribution</h3>
        <p className="text-xs text-slate-500">
          Iterations: {result.iterations.toLocaleString()} | Success: {(result.successRate * 100).toFixed(1)}%
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Low (P10)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{money(result.p10)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Median (P50)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{money(result.p50)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">High (P90)</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{money(result.p90)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Mean</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{money(result.mean)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Distribution Histogram</p>
        <div className="mt-2 space-y-1">
          {result.histogram.map((bin) => (
            <div key={`${bin.start}-${bin.end}`} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-slate-500">
                {money(bin.start)}-{money(bin.end)}
              </span>
              <div className="h-2 flex-1 rounded bg-slate-100">
                <div
                  className="h-2 rounded bg-sky-500"
                  style={{ width: `${(bin.count / maxBin) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-slate-700">{bin.count}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Range: {money(result.min)} to {money(result.max)}
        </p>
      </div>
    </section>
  );
}
