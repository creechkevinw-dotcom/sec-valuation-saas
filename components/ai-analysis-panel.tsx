"use client";

import type { AiCompanyAnalysis } from "@/types/valuation";
import { useState } from "react";

export function AiAnalysisPanel({ valuationId }: { valuationId: string }) {
  const [analysis, setAnalysis] = useState<AiCompanyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean | null>(null);

  async function runAnalysis(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuationId, forceRefresh }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload.error ?? "Failed to generate AI analysis.");
        return;
      }

      setAnalysis(payload.analysis ?? null);
      setCached(Boolean(payload.cached));
    } catch {
      setError("Network error while generating analysis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">AI Company Analysis</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => runAnalysis(false)}
            disabled={loading}
            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Analyzing..." : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => runAnalysis(true)}
            disabled={loading}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      {!analysis && !loading && !error ? (
        <p className="text-sm text-slate-500">
          No AI analysis yet. Generate to receive structured, evidence-based interpretation.
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {analysis ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Conviction: <span className="font-semibold uppercase">{analysis.conviction}</span>{" "}
            {cached !== null ? `(${cached ? "cached" : "fresh"})` : ""}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <Info title="Profitability" body={analysis.profitability_summary} />
            <Info title="Growth" body={analysis.growth_summary} />
            <Info title="Cash Flow" body={analysis.cash_flow_summary} />
            <Info title="Balance Sheet" body={analysis.balance_sheet_summary} />
            <Info title="Liquidity" body={analysis.liquidity_summary} />
          </div>

          <List title="Conviction Reasoning" items={analysis.conviction_reasoning} />
          <List title="Strengths" items={analysis.strengths} />
          <List title="Risks" items={analysis.risks} />
          <List title="What Would Change View" items={analysis.what_would_change_view} />
          <List title="Trade Scenarios" items={analysis.trade_scenarios} />
          <List title="Missing Data" items={analysis.missing_data} />

          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {analysis.disclaimer}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm text-slate-700">{body}</p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">None reported.</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
