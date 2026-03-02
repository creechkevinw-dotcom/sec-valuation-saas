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
    };
    governanceSignals?: string[];
  };
}) {
  if (!enrichment) {
    return null;
  }

  const liquidity = enrichment.liquidity ?? {};
  const intensity = enrichment.intensity ?? {};
  const sections = enrichment.filingSections ?? {};
  const consensus = enrichment.consensus;
  const governanceSignals = enrichment.governanceSignals ?? [];

  const snippets = [
    { label: "10-K MD&A", value: sections.latest10kMdna },
    { label: "10-K Risk Factors", value: sections.latest10kRiskFactors },
    { label: "10-K Segment Notes", value: sections.latest10kSegmentNotes },
    { label: "10-Q MD&A", value: sections.latest10qMdna },
    { label: "10-Q Risk Factors", value: sections.latest10qRiskFactors },
    { label: "10-Q Segment Notes", value: sections.latest10qSegmentNotes },
  ].filter((s) => Boolean(s.value));

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
        <Metric label="Capex / Revenue" value={intensity.capexToRevenue} pct />
        <Metric label="R&D / Revenue" value={intensity.rAndDToRevenue} pct />
        <Metric label="SBC / Revenue" value={intensity.sbcToRevenue} pct />
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

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Extracted Filing Snippets</p>
        {!snippets.length ? (
          <p className="text-sm text-slate-500">No filing snippets extracted from latest 10-K/10-Q documents.</p>
        ) : (
          snippets.map((snippet) => (
            <article key={snippet.label} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">{snippet.label}</p>
              <p className="mt-1 line-clamp-5 text-sm text-slate-700">{snippet.value}</p>
            </article>
          ))
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
