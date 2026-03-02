export function EnrichmentPanel({
  enrichment,
}: {
  enrichment?: {
    liquidity?: {
      currentRatio?: number;
      quickRatio?: number;
      interestCoverage?: number;
      debtToFcf?: number | null;
      cashToDebt?: number;
    };
    intensity?: {
      capexToRevenue?: number;
      rAndDToRevenue?: number;
      sbcToRevenue?: number;
      fcfMargin?: number;
    };
    leverage?: {
      debtToEquity?: number | null;
      shortDebtPct?: number | null;
      currentMaturityDebtPct?: number | null;
      bookValuePerShare?: number;
    };
    segmentMetrics?: {
      latest10kSegmentRevenueMentions?: number;
      latest10kSegmentOperatingIncomeMentions?: number;
      latest10qSegmentRevenueMentions?: number;
      latest10qSegmentOperatingIncomeMentions?: number;
    };
    filingSections?: {
      latest10kMdna?: string | null;
      latest10kRiskFactors?: string | null;
      latest10kSegmentNotes?: string | null;
      latest10qMdna?: string | null;
      latest10qRiskFactors?: string | null;
      latest10qSegmentNotes?: string | null;
    };
    consensus?: {
      enabled?: boolean;
      available?: boolean;
      source?: string;
      notes?: string;
      forwardRevenueGrowthPct?: number;
      forwardEpsGrowthPct?: number;
      analystCount?: number;
      targetMean?: number;
      targetHigh?: number;
      targetLow?: number;
      ratingConsensus?: string;
      revisionTrend?: "up" | "down" | "flat";
      updatedAt?: string;
    };
    governanceSignals?: string[];
    deterministicMissingData?: string[];
  };
}) {
  if (!enrichment) {
    return null;
  }

  const liquidity = enrichment.liquidity ?? {};
  const intensity = enrichment.intensity ?? {};
  const leverage = enrichment.leverage ?? {};
  const segmentMetrics = enrichment.segmentMetrics ?? {};
  const consensus = enrichment.consensus;
  const governanceSignals = enrichment.governanceSignals ?? [];
  const deterministicMissingData = enrichment.deterministicMissingData ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header>
        <h3 className="text-lg font-semibold text-slate-900">Data Enrichment</h3>
        <p className="text-sm text-slate-600">
          Deterministic metrics and extracted filing context used to improve model explainability.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="Current Ratio" value={liquidity.currentRatio} />
        <Metric label="Quick Ratio" value={liquidity.quickRatio} />
        <Metric label="Interest Coverage" value={liquidity.interestCoverage} />
        <Metric label="Cash / Debt" value={liquidity.cashToDebt} />
        <Metric label="Debt / FCF" value={liquidity.debtToFcf ?? undefined} />
        <Metric label="Debt / Equity" value={leverage.debtToEquity ?? undefined} />
        <Metric label="Book Value / Share" value={leverage.bookValuePerShare} />
        <Metric label="Capex / Revenue" value={intensity.capexToRevenue} pct />
        <Metric label="R&D / Revenue" value={intensity.rAndDToRevenue} pct />
        <Metric label="SBC / Revenue" value={intensity.sbcToRevenue} pct />
        <Metric label="Short Debt %" value={leverage.shortDebtPct ?? undefined} pct />
        <Metric label="Current LT Debt %" value={leverage.currentMaturityDebtPct ?? undefined} pct />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-800">Segment Extraction Counters</p>
        <div className="mt-1 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
          <p>10-K revenue mentions: {segmentMetrics.latest10kSegmentRevenueMentions ?? 0}</p>
          <p>10-K operating income mentions: {segmentMetrics.latest10kSegmentOperatingIncomeMentions ?? 0}</p>
          <p>10-Q revenue mentions: {segmentMetrics.latest10qSegmentRevenueMentions ?? 0}</p>
          <p>10-Q operating income mentions: {segmentMetrics.latest10qSegmentOperatingIncomeMentions ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-800">Consensus / Guidance Provider</p>
        {!consensus ? (
          <p className="mt-1 text-sm text-slate-500">No consensus snapshot attached.</p>
        ) : (
          <div className="mt-1 space-y-1 text-sm text-slate-700">
            <p>
              Enabled: <span className="font-semibold">{String(Boolean(consensus.enabled))}</span> | Available:{" "}
              <span className="font-semibold">{String(Boolean(consensus.available))}</span> | Source:{" "}
              <span className="font-semibold">{consensus.source ?? "none"}</span>
            </p>
            {consensus.forwardRevenueGrowthPct != null ? (
              <p>Forward Revenue Growth: {consensus.forwardRevenueGrowthPct.toFixed(2)}%</p>
            ) : null}
            {consensus.forwardEpsGrowthPct != null ? (
              <p>Forward EPS Growth: {consensus.forwardEpsGrowthPct.toFixed(2)}%</p>
            ) : null}
            {consensus.analystCount != null ? <p>Analyst Count: {consensus.analystCount}</p> : null}
            {consensus.targetMean != null ? <p>Target Mean: ${consensus.targetMean.toFixed(2)}</p> : null}
            {consensus.targetHigh != null ? <p>Target High: ${consensus.targetHigh.toFixed(2)}</p> : null}
            {consensus.targetLow != null ? <p>Target Low: ${consensus.targetLow.toFixed(2)}</p> : null}
            {consensus.ratingConsensus ? <p>Rating Consensus: {consensus.ratingConsensus}</p> : null}
            {consensus.revisionTrend ? <p>Revision Trend: {consensus.revisionTrend}</p> : null}
            {consensus.updatedAt ? <p>Updated: {new Date(consensus.updatedAt).toLocaleDateString()}</p> : null}
            {consensus.notes ? <p className="text-slate-500">{consensus.notes}</p> : null}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-800">Governance / Risk Signals</p>
        {!governanceSignals.length ? (
          <p className="mt-1 text-sm text-slate-500">No governance signals extracted.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {governanceSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-semibold text-slate-800">Deterministic Missing Data</p>
        {!deterministicMissingData.length ? (
          <p className="mt-1 text-sm text-slate-500">No deterministic extraction gaps detected.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
            {deterministicMissingData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  pct = false,
}: {
  label: string;
  value?: number;
  pct?: boolean;
}) {
  const formatted =
    value == null || !Number.isFinite(value)
      ? "-"
      : pct
        ? `${(value * 100).toFixed(2)}%`
        : value.toFixed(2);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{formatted}</p>
    </div>
  );
}
