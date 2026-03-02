export function ConsensusSummaryCard({
  consensus,
}: {
  consensus?: {
    enabled?: boolean;
    available?: boolean;
    analystCount?: number;
    targetLow?: number;
    targetMean?: number;
    targetHigh?: number;
    ratingConsensus?: string;
    ratingScore?: number;
    revisionTrend?: "up" | "down" | "flat";
    updatedAt?: string;
    notes?: string;
  };
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Analyst Consensus</h3>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
          {consensus?.available ? "Live" : "Unavailable"}
        </span>
      </div>

      {!consensus?.enabled ? (
        <p className="mt-2 text-sm text-slate-500">Consensus feed is disabled.</p>
      ) : !consensus?.available ? (
        <p className="mt-2 text-sm text-slate-500">{consensus?.notes ?? "Consensus data not available for this ticker."}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Target Low</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(consensus.targetLow)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Target Medium</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(consensus.targetMean)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Target High</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(consensus.targetHigh)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Average Rating</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {consensus.ratingConsensus ?? "-"}
              {consensus.ratingScore != null ? ` (${consensus.ratingScore.toFixed(2)}/5)` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Analysts: {consensus.analystCount ?? "-"} | Revision: {consensus.revisionTrend ?? "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Updated: {consensus.updatedAt ? new Date(consensus.updatedAt).toLocaleDateString() : "-"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function formatMoney(value?: number) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `$${value.toFixed(2)}`;
}
