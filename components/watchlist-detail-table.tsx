"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useState } from "react";

type WatchlistItem = {
  id: string;
  ticker: string;
  created_at: string;
};

type AiAnalysis = {
  conviction?: "low" | "medium" | "high";
  conviction_reasoning?: string[];
  profitability_summary?: string;
  risks?: string[];
  strengths?: string[];
};

type ValuationRow = {
  id: string;
  ticker: string;
  health_score: number | null;
  fair_value_base: number | string | null;
  created_at: string;
  ai_analysis?: AiAnalysis | null;
};

export function WatchlistDetailTable({
  items,
  recentValuations,
}: {
  items: WatchlistItem[];
  recentValuations: ValuationRow[];
}) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-2">Ticker</th>
            <th className="pb-2">Added</th>
            <th className="pb-2">Latest Health</th>
            <th className="pb-2">Latest Base Fair Value</th>
            <th className="pb-2">Latest Valuation</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const latest = recentValuations.find((v) => v.ticker === item.ticker);
            const expanded = expandedTicker === item.ticker;
            const analysis = latest?.ai_analysis ?? null;

            return (
              <Fragment key={item.id}>
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedTicker(expanded ? null : item.ticker)}
                      className="font-semibold text-slate-900 underline"
                    >
                      {item.ticker}
                    </button>
                  </td>
                  <td className="py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="py-2">{latest?.health_score ?? "-"}</td>
                  <td className="py-2">
                    {latest?.fair_value_base != null ? `$${Number(latest.fair_value_base).toFixed(2)}` : "-"}
                  </td>
                  <td className="py-2">
                    {latest ? (
                      <Link href={`/valuation/${latest.id}`} className="text-sky-700 underline">
                        Open report
                      </Link>
                    ) : (
                      <span className="text-slate-500">No valuation yet</span>
                    )}
                  </td>
                </tr>

                {expanded ? (
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    <td colSpan={5} className="p-4">
                      {!analysis ? (
                        <p className="text-sm text-slate-500">
                          No AI analysis available yet. Open latest valuation and run/regenerate AI analysis.
                        </p>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <p className="text-slate-800">
                            <span className="font-semibold">Conviction:</span>{" "}
                            <span className="uppercase">{analysis.conviction ?? "unknown"}</span>
                          </p>
                          {analysis.profitability_summary ? (
                            <p className="text-slate-700">
                              <span className="font-semibold">Profitability:</span>{" "}
                              {analysis.profitability_summary}
                            </p>
                          ) : null}
                          {analysis.conviction_reasoning?.length ? (
                            <p className="text-slate-700">
                              <span className="font-semibold">Key reasoning:</span>{" "}
                              {analysis.conviction_reasoning.slice(0, 2).join(" | ")}
                            </p>
                          ) : null}
                          {analysis.strengths?.length ? (
                            <p className="text-emerald-700">
                              <span className="font-semibold">Top strengths:</span>{" "}
                              {analysis.strengths.slice(0, 2).join(" | ")}
                            </p>
                          ) : null}
                          {analysis.risks?.length ? (
                            <p className="text-rose-700">
                              <span className="font-semibold">Top risks:</span>{" "}
                              {analysis.risks.slice(0, 2).join(" | ")}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
