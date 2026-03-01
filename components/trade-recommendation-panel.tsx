"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MarketSnapshot = {
  ticker: string;
  price: number;
  bid: number;
  ask: number;
  spreadPct: number;
  sessionStatus: "PRE" | "OPEN" | "POST" | "CLOSED";
  lastTradeTimestamp: string;
};

type TradeLeg = {
  direction: "long" | "short";
  entry: number;
  target: number;
  stop: number;
  rewardRisk: number;
  thesis: string;
};

type TradeSuccessPayload = {
  refused: false;
  ticker: string;
  marketSnapshot: MarketSnapshot;
  technicalSnapshot: {
    sma20: number;
    sma50: number;
    sma200: number;
    rsi14: number;
    macd: number;
    atr14: number;
    momentumScore: number;
  };
  earningsData: {
    nextEarningsDate: string | null;
    daysUntilEarnings: number | null;
    earningsRisk: boolean;
  };
  deterministicSignal: {
    bias: "long" | "short" | "mixed";
    technicalScore: number;
    fundamentalScore: number;
    liquidityScore: number;
    momentumScore: number;
  };
  deterministicRecommendation: {
    shortTermTrade: TradeLeg | null;
    longTermTrade: TradeLeg | null;
    optionsStrategy: string | null;
    riskFactors: string[];
  };
  aiExplanation: {
    shortTermTrade: string;
    longTermTrade: string;
    optionsStrategy: string;
    riskFactors: string[];
    confidenceAdjustment: number;
  };
  finalConfidence: number;
  dataTimestamp: string;
};

type TradeRefusalPayload = {
  refused: true;
  reasonCode: string;
  reason: string;
  details?: Record<string, unknown>;
};

const CONSENT_VERSION = "v1";

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function ConfidenceMeter({ value }: { value: number }) {
  const level = Math.max(0, Math.min(100, value));
  const color = level >= 70 ? "bg-emerald-500" : level >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>Confidence</span>
        <span className="font-semibold text-slate-900">{level.toFixed(0)}/100</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${level}%` }} />
      </div>
    </div>
  );
}

function TradeLegCard({ title, leg, analysis }: { title: string; leg: TradeLeg | null; analysis: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {!leg ? (
        <p className="mt-2 text-sm text-slate-500">No deterministic setup at current signal conditions.</p>
      ) : (
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <p>
            <span className="font-semibold uppercase">{leg.direction}</span> | Entry {formatMoney(leg.entry)} | Target {formatMoney(leg.target)} | Stop {formatMoney(leg.stop)}
          </p>
          <p>Reward/Risk: {leg.rewardRisk.toFixed(2)}:1</p>
          <p>{leg.thesis}</p>
        </div>
      )}
      <p className="mt-3 rounded-md bg-slate-50 p-2 text-sm text-slate-700">{analysis}</p>
    </div>
  );
}

export function TradeRecommendationPanel({ ticker }: { ticker: string }) {
  const [consentAccepted, setConsentAccepted] = useState<boolean | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);

  const [liveSnapshot, setLiveSnapshot] = useState<MarketSnapshot | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TradeSuccessPayload | null>(null);
  const [refusal, setRefusal] = useState<TradeRefusalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConsent() {
    try {
      const res = await fetch("/api/recommendation-consent");
      const payload = await res.json();
      if (!res.ok) {
        setConsentAccepted(false);
      } else {
        setConsentAccepted(Boolean(payload.accepted));
      }
    } catch {
      setConsentAccepted(false);
    }
  }

  async function acceptConsent() {
    setConsentBusy(true);
    try {
      const res = await fetch("/api/recommendation-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentVersion: CONSENT_VERSION }),
      });
      if (res.ok) {
        setConsentAccepted(true);
      }
    } finally {
      setConsentBusy(false);
    }
  }

  const loadLiveSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-recommendation/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setLiveError(payload.error ?? "Live market feed unavailable");
        return;
      }
      setLiveSnapshot(payload.snapshot ?? null);
      setLiveError(null);
    } catch {
      setLiveError("Live market feed unavailable");
    }
  }, [ticker]);

  async function generateRecommendation() {
    setBusy(true);
    setError(null);
    setRefusal(null);

    try {
      const res = await fetch("/api/trade-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const payload = (await res.json()) as TradeSuccessPayload | TradeRefusalPayload;

      if ((payload as TradeRefusalPayload).refused) {
        setResult(null);
        setRefusal(payload as TradeRefusalPayload);
      } else {
        setResult(payload as TradeSuccessPayload);
        setRefusal(null);
      }
    } catch {
      setError("Failed to generate trade recommendation.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadConsent();
  }, []);

  useEffect(() => {
    void loadLiveSnapshot();
    const timer = setInterval(() => {
      void loadLiveSnapshot();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadLiveSnapshot]);

  const combinedRisks = useMemo(() => {
    if (!result) return [];
    const merged = new Set([...result.deterministicRecommendation.riskFactors, ...result.aiExplanation.riskFactors]);
    return Array.from(merged);
  }, [result]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Live Market</p>
          {liveSnapshot ? (
            <p className="text-sm text-slate-800">
              {liveSnapshot.ticker} {formatMoney(liveSnapshot.price)} | Bid {formatMoney(liveSnapshot.bid)} | Ask {formatMoney(liveSnapshot.ask)} | Spread {liveSnapshot.spreadPct.toFixed(2)}%
            </p>
          ) : (
            <p className="text-sm text-slate-500">Loading live market snapshot...</p>
          )}
          {liveError ? <p className="text-xs text-rose-600">{liveError}</p> : null}
        </div>
        <div className="text-right">
          <span className="inline-flex rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
            Session: {liveSnapshot?.sessionStatus ?? "-"}
          </span>
          <p className="mt-1 text-xs text-slate-500">
            {liveSnapshot?.lastTradeTimestamp
              ? `Data: ${new Date(liveSnapshot.lastTradeTimestamp).toLocaleString()}`
              : "Data timestamp pending"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Deterministic Trade Recommendation</h3>
          <p className="text-sm text-slate-600">
            Signal-first output with AI explanation only. Refuses when data quality or risk checks fail.
          </p>
        </div>
        <button
          type="button"
          onClick={generateRecommendation}
          disabled={busy || !consentAccepted}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Generating..." : "Generate"}
        </button>
      </div>

      {consentAccepted === false ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Compliance acknowledgment required</p>
          <p className="mt-1">This is an educational tool, not financial advice. Market losses are possible, including total loss.</p>
          <button
            type="button"
            onClick={acceptConsent}
            disabled={consentBusy}
            className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {consentBusy ? "Saving..." : "I Understand and Accept"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {refusal ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-800">Recommendation refused: {refusal.reasonCode}</p>
          <p className="mt-1 text-sm text-rose-700">{refusal.reason}</p>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Deterministic Bias</p>
              <p className="text-lg font-semibold uppercase text-slate-900">{result.deterministicSignal.bias}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Earnings Countdown</p>
              <p className="text-lg font-semibold text-slate-900">
                {result.earningsData.daysUntilEarnings != null ? `${result.earningsData.daysUntilEarnings} days` : "No date"}
              </p>
              {result.earningsData.earningsRisk ? <p className="text-xs text-amber-700">Elevated earnings event risk</p> : null}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <ConfidenceMeter value={result.finalConfidence} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <TradeLegCard
              title="Short-Term Trade"
              leg={result.deterministicRecommendation.shortTermTrade}
              analysis={result.aiExplanation.shortTermTrade}
            />
            <TradeLegCard
              title="Long-Term Trade"
              leg={result.deterministicRecommendation.longTermTrade}
              analysis={result.aiExplanation.longTermTrade}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Options Strategy</h4>
            <p className="mt-1 text-sm text-slate-700">
              {result.deterministicRecommendation.optionsStrategy ?? "No deterministic options strategy available."}
            </p>
            <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-700">{result.aiExplanation.optionsStrategy}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Technical Dashboard</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                <p>RSI(14): {result.technicalSnapshot.rsi14.toFixed(2)}</p>
                <p>MACD: {result.technicalSnapshot.macd.toFixed(2)}</p>
                <p>SMA20: {result.technicalSnapshot.sma20.toFixed(2)}</p>
                <p>SMA50: {result.technicalSnapshot.sma50.toFixed(2)}</p>
                <p>SMA200: {result.technicalSnapshot.sma200.toFixed(2)}</p>
                <p>ATR(14): {result.technicalSnapshot.atr14.toFixed(2)}</p>
                <p>Tech Score: {result.deterministicSignal.technicalScore.toFixed(1)}</p>
                <p>Fund Score: {result.deterministicSignal.fundamentalScore.toFixed(1)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Risk Badges</h4>
              {!combinedRisks.length ? (
                <p className="mt-2 text-sm text-slate-500">No risks returned.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {combinedRisks.map((risk) => (
                    <li key={risk} className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800">
                      {risk}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">Data timestamp: {new Date(result.dataTimestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Generate a recommendation to view deterministic trade setup, risk checks, and AI interpretation.</p>
      )}
    </section>
  );
}
