import { explainRecommendation } from "@/lib/trade/aiExplainer";
import { getEarningsSnapshot } from "@/lib/trade/earnings";
import { getMarketSnapshot } from "@/lib/trade/marketData";
import { getOptionsSnapshot } from "@/lib/trade/optionsEngine";
import { buildDeterministicRecommendation, liquidityGate, validateRiskReward } from "@/lib/trade/riskValidator";
import { composeConfidence, computeSignal } from "@/lib/trade/signalEngine";
import { getTechnicalSnapshot } from "@/lib/trade/technicalEngine";
import type { FundamentalSnapshot, OptionsSnapshot, TradeRecommendationResult, TradeRefusal } from "@/lib/trade/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient;

function refusal(
  reasonCode: TradeRefusal["reasonCode"],
  reason: string,
  details?: Record<string, unknown>,
): TradeRecommendationResult {
  return { refused: true, reasonCode, reason, details };
}

function parseStooqDailyDollarVolume(csv: string): number | null {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) return null;

  const rows = lines
    .slice(1)
    .map((line) => line.split(","))
    .map((cols) => {
      const close = Number(cols[4]);
      const volume = Number(cols[5]);
      return Number.isFinite(close) && Number.isFinite(volume) && close > 0 && volume > 0
        ? { close, volume }
        : null;
    })
    .filter((row): row is { close: number; volume: number } => row !== null);

  if (rows.length === 0) return null;
  const n = Math.min(20, rows.length);
  const sample = rows.slice(-n);
  const sum = sample.reduce((acc, row) => acc + row.close * row.volume, 0);
  return sum / n;
}

async function getProfileFundamentals(
  ticker: string,
  supabase: AnyDb,
  userId: string,
  marketFallbackDollarVolume: number,
): Promise<FundamentalSnapshot> {
  const latestValuation = await supabase
    .from("valuations")
    .select("health_score,fair_value_base")
    .eq("user_id", userId)
    .eq("ticker", ticker)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error("Missing FINNHUB_API_KEY");
  }

  let marketCap: number | null = null;
  let marketCapSource = "none";
  const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`, {
    cache: "no-store",
  });
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as { marketCapitalization?: number };
    if (profile.marketCapitalization != null) {
      marketCap = Number(profile.marketCapitalization) * 1_000_000;
      marketCapSource = "finnhub";
    }
  }

  let avgDailyDollarVolume: number | null = null;
  let volumeSource = "none";
  const candleRes = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${Math.floor(Date.now() / 1000) - 90 * 86400}&to=${Math.floor(Date.now() / 1000)}&token=${key}`,
    { cache: "no-store" },
  );
  if (candleRes.ok) {
    const candles = (await candleRes.json()) as { c?: number[]; v?: number[]; s?: string };
    if (candles.s === "ok" && candles.c && candles.v && candles.c.length > 0) {
      const n = Math.min(candles.c.length, 20);
      let sum = 0;
      for (let i = candles.c.length - n; i < candles.c.length; i += 1) {
        sum += candles.c[i] * candles.v[i];
      }
      avgDailyDollarVolume = sum / n;
      volumeSource = "finnhub";
    }
  }

  if (avgDailyDollarVolume == null) {
    const stooqRes = await fetch(`https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`, {
      cache: "no-store",
    });
    if (stooqRes.ok) {
      const parsed = parseStooqDailyDollarVolume(await stooqRes.text());
      if (parsed != null) {
        avgDailyDollarVolume = parsed;
        volumeSource = "stooq";
      }
    }
  }

  if (avgDailyDollarVolume == null && marketFallbackDollarVolume > 0) {
    avgDailyDollarVolume = marketFallbackDollarVolume;
    volumeSource = "quote_fallback";
  }

  if (avgDailyDollarVolume == null) {
    throw new Error("Fundamental candle provider error");
  }

  return {
    healthScore: latestValuation.data?.health_score ?? 50,
    baseFairValue: latestValuation.data?.fair_value_base ? Number(latestValuation.data.fair_value_base) : null,
    marketCap,
    avgDailyDollarVolume,
    source: `supabase+marketcap:${marketCapSource}+liquidity:${volumeSource}`,
  };
}

export async function generateTradeRecommendation(params: {
  ticker: string;
  userId: string;
  supabase: AnyDb;
}): Promise<TradeRecommendationResult> {
  const ticker = params.ticker.trim().toUpperCase();

  let market;
  try {
    market = await getMarketSnapshot(ticker);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("halt")) {
      return refusal("MARKET_HALTED", "Ticker is halted or inactive", { message });
    }
    if (message.toLowerCase().includes("stale")) {
      return refusal("DATA_STALE", "Market snapshot unavailable or stale", { message });
    }
    return refusal("PROVIDER_ERROR", "Market provider error", { message });
  }

  if (market.halted || !market.active) {
    return refusal("MARKET_HALTED", "Ticker is halted or inactive");
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return refusal("PROVIDER_ERROR", "Market provider key missing");
  }
  const vixRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=VIX&token=${key}`, { cache: "no-store" });
  if (vixRes.ok) {
    const vix = (await vixRes.json()) as { c?: number };
    if ((vix.c ?? 0) >= 40) {
      return refusal("PROVIDER_ERROR", "Circuit breaker: extreme volatility regime (VIX)");
    }
  }

  let technical;
  try {
    technical = await getTechnicalSnapshot(ticker);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("RATE_LIMIT")) {
      return refusal("RATE_LIMIT", "Technical data provider rate limit reached", { message });
    }
    if (message.includes("PROVIDER_ERROR")) {
      return refusal("PROVIDER_ERROR", "Technical data provider unavailable", { message });
    }
    if (message.includes("NO_DATA")) {
      return refusal("INSUFFICIENT_DATA", "No technical candle data available for ticker", { message });
    }
    return refusal("INSUFFICIENT_DATA", "Technical data insufficient", { message });
  }

  let earnings;
  try {
    earnings = await getEarningsSnapshot(ticker);
  } catch (error) {
    return refusal("PROVIDER_ERROR", "Earnings data unavailable", { message: String(error) });
  }

  let optionsAvailable = true;
  let options: OptionsSnapshot;
  try {
    options = await getOptionsSnapshot(ticker);
  } catch (error) {
    optionsAvailable = false;
    options = {
      contracts: [],
      putCallRatio: null,
      ivRank: null,
      avgSpreadPct: null,
      totalOi: 0,
      liquid: false,
      source: "unavailable",
    };
    console.warn("Options data unavailable, switching to equity-only mode", {
      ticker,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let fundamentals;
  try {
    const marketFallbackDollarVolume = market.price > 0 && market.volume > 0 ? market.price * market.volume : 0;
    fundamentals = await getProfileFundamentals(
      ticker,
      params.supabase,
      params.userId,
      marketFallbackDollarVolume,
    );
  } catch (error) {
    return refusal("PROVIDER_ERROR", "Fundamental snapshot unavailable", { message: String(error) });
  }

  const liqGate = liquidityGate({
    avgDailyDollarVolume: fundamentals.avgDailyDollarVolume,
    marketCap: fundamentals.marketCap,
    options,
    optionsAvailable,
    technical,
    market,
  });
  if (!liqGate.ok) {
    return refusal("LIQUIDITY_LOW", liqGate.reason ?? "Liquidity gate failed");
  }

  const signal = computeSignal({ technical, market, fundamentals, options });
  let recommendation = buildDeterministicRecommendation({
    signal,
    market,
    technical,
    earnings,
    optionsAvailable,
  });

  if (earnings.sameWeek && recommendation.optionsStrategy && !recommendation.optionsStrategy.toLowerCase().includes("volatility")) {
    return refusal("EARNINGS_RISK_BLOCK", "Earnings week blocks directional short-term options strategy");
  }

  const riskCheck = validateRiskReward(recommendation);
  if (!riskCheck.ok) {
    return refusal("RISK_REWARD_INVALID", riskCheck.reason ?? "Risk validation failed");
  }

  const confidence = composeConfidence(signal);

  let aiExplanation;
  try {
    aiExplanation = await explainRecommendation({
      marketSnapshot: market,
      technicalSnapshot: technical,
      fundamentalSnapshot: fundamentals,
      optionsSnapshot: options,
      deterministicSignal: signal,
      deterministicRecommendation: recommendation,
      confidenceScore: confidence,
      earningsData: earnings,
    });
  } catch (error) {
    aiExplanation = {
      shortTermTrade:
        recommendation.shortTermTrade?.thesis ??
        "Deterministic short-term setup unavailable for current signal state.",
      longTermTrade:
        recommendation.longTermTrade?.thesis ??
        "Deterministic long-term setup unavailable for current signal state.",
      optionsStrategy:
        recommendation.optionsStrategy ??
        "Options strategy unavailable. Use equity-only interpretation from deterministic signal.",
      riskFactors: [
        "AI narrative fallback in use",
        "Review deterministic entry, stop, and target directly",
      ],
      confidenceAdjustment: 0,
    };
    console.warn("AI explanation unavailable; using deterministic fallback", {
      ticker,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const finalConfidence = Math.max(0, Math.min(100, confidence + aiExplanation.confidenceAdjustment));
  recommendation = {
    ...recommendation,
    confidenceScore: finalConfidence,
    riskFactors: [
      "Volatility risk",
      "Liquidity risk",
      earnings.earningsRisk ? "Earnings event risk (<7 days)" : "No immediate earnings event",
      ...(optionsAvailable ? [] : ["Options chain unavailable: recommendation generated in equity-only mode"]),
      ...(fundamentals.source.includes("quote_fallback")
        ? ["Liquidity metrics used quote-derived fallback due candle provider limits"]
        : []),
    ],
  };

  return {
    refused: false,
    ticker,
    marketSnapshot: market,
    technicalSnapshot: technical,
    fundamentalSnapshot: fundamentals,
    optionsSnapshot: options,
    earningsData: earnings,
    deterministicSignal: signal,
    deterministicRecommendation: recommendation,
    aiExplanation,
    finalConfidence,
    dataTimestamp: market.lastTradeTimestamp,
    source: "finnhub+supabase+openai",
  };
}
