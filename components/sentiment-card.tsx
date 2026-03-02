"use client";

import { useEffect, useMemo, useState } from "react";

type SentimentHeadline = {
  title: string;
  source: string;
  publishedAt: string;
  sentiment: "positive" | "neutral" | "negative";
};

type SentimentSnapshot = {
  enabled: boolean;
  available: boolean;
  ticker: string;
  score: number;
  label: "bullish" | "neutral" | "bearish";
  trend: "up" | "flat" | "down";
  confidence: number;
  articleCount: number;
  sourceCount: number;
  topHeadlines: SentimentHeadline[];
  updatedAt: string;
  reason?: string;
};

function scoreColor(score: number) {
  if (score >= 20) return "text-emerald-700";
  if (score <= -20) return "text-rose-700";
  return "text-slate-700";
}

function sentimentBadge(sentiment: SentimentHeadline["sentiment"]) {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700";
  if (sentiment === "negative") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export function SentimentCard({ ticker }: { ticker: string }) {
  const [sentiment, setSentiment] = useState<SentimentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const payload = await res.json();
        if (!res.ok) {
          if (mounted) setError(payload.error ?? "Sentiment unavailable.");
        } else if (mounted) {
          setSentiment(payload.sentiment ?? null);
        }
      } catch {
        if (mounted) setError("Sentiment unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [ticker]);

  const tone = useMemo(() => scoreColor(sentiment?.score ?? 0), [sentiment?.score]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">Market Sentiment</h3>
        {sentiment?.available ? (
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
            Live
          </span>
        ) : null}
      </div>

      {loading ? <p className="mt-2 text-sm text-slate-500">Loading sentiment snapshot...</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      {!loading && !error && sentiment && !sentiment.available ? (
        <p className="mt-2 text-sm text-slate-500">{sentiment.reason ?? "Sentiment feed unavailable."}</p>
      ) : null}

      {!loading && !error && sentiment?.available ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Sentiment Score</p>
              <p className={`mt-1 text-xl font-semibold ${tone}`}>{sentiment.score.toFixed(1)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Label</p>
              <p className="mt-1 text-xl font-semibold uppercase text-slate-900">{sentiment.label}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Confidence</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{sentiment.confidence}/100</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Coverage</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {sentiment.articleCount} articles | {sentiment.sourceCount} sources
              </p>
              <p className="mt-1 text-xs text-slate-500">Trend: {sentiment.trend}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recent Headlines</p>
            <ul className="mt-2 space-y-2">
              {sentiment.topHeadlines.map((item) => (
                <li key={`${item.source}-${item.publishedAt}-${item.title}`} className="rounded border border-slate-100 p-2">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{item.source}</span>
                    <span>{new Date(item.publishedAt).toLocaleString()}</span>
                    <span className={`rounded px-2 py-0.5 font-semibold ${sentimentBadge(item.sentiment)}`}>
                      {item.sentiment}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Updated: {new Date(sentiment.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
