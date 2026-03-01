import { explainRecommendation } from "@/lib/trade/aiExplainer";
import { getEarningsSnapshot } from "@/lib/trade/earnings";
import { getMarketSnapshot } from "@/lib/trade/marketData";
import { getOptionsSnapshot } from "@/lib/trade/optionsEngine";
import { buildDeterministicRecommendation, liquidityGate, validateRiskReward } from "@/lib/trade/riskValidator";
import { composeConfidence, computeSignal } from "@/lib/trade/signalEngine";
import { getTechnicalSnapshot } from "@/lib/trade/technicalEngine";
import type { FundamentalSnapshot, TradeRecommendationResult, TradeRefusal } from "@/lib/trade/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient;

function refusal(
  reasonCode: TradeRefusal["reasonCode"],
  reason: string,
  details?: Record<string, unknown>,
): TradeRecommendationResult {
  return { refused: true, reasonCode, reason, details };
}

async function getProfileFundamentals(ticker: string, supabase: AnyDb, userId: string): Promise<FundamentalSnapshot> {
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
  const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`, {
    cache: "no-store",
  });
  if (!profileRes.ok) {
    throw new Error("Fundamental provider error");
  }
  const profile = (await profileRes.json()) as { marketCapitalization?: number };

  const candleRes = await fetch(
    `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${Math.floor(Date.now() / 1000) - 90 * 86400}&to=${Math.floor(Date.now() / 1000)}&token=${key}`,
    { cache: "no-store" },
  );
  if (!candleRes.ok) {
    throw new Error("Fundamental candle provider error");
  }
  const candles = (await candleRes.json()) as { c?: number[]; v?: number[]; s?: string };
  if (candles.s !== "ok" || !candles.c || !candles.v || candles.c.length === 0) {
    throw new Error("Insufficient candles for liquidity");
  }
  const n = Math.min(candles.c.length, 20);
  let sum = 0;
  for (let i = candles.c.length - n; i < candles.c.length; i += 1) {
    sum += candles.c[i] * candles.v[i];
  }
  const avgDailyDollarVolume = sum / n;

  return {
    healthScore: latestValuation.data?.health_score ?? 50,
    baseFairValue: latestValuation.data?.fair_value_base ? Number(latestValuation.data.fair_value_base) : null,
    marketCap:
      profile.marketCapitalization != null ? Number(profile.marketCapitalization) * 1_000_000 : null,
    avgDailyDollarVolume,
    source: "finnhub+supabase",
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
    return refusal("INSUFFICIENT_DATA", "Technical data insufficient", { message: String(error) });
  }

  let earnings;
  try {
    earnings = await getEarningsSnapshot(ticker);
  } catch (error) {
    return refusal("PROVIDER_ERROR", "Earnings data unavailable", { message: String(error) });
  }

  let options;
  try {
    options = await getOptionsSnapshot(ticker);
  } catch (error) {
    return refusal("PROVIDER_ERROR", "Options chain unavailable", { message: String(error) });
  }

  let fundamentals;
  try {
    fundamentals = await getProfileFundamentals(ticker, params.supabase, params.userId);
  } catch (error) {
    return refusal("PROVIDER_ERROR", "Fundamental snapshot unavailable", { message: String(error) });
  }

  const liqGate = liquidityGate({
    avgDailyDollarVolume: fundamentals.avgDailyDollarVolume,
    marketCap: fundamentals.marketCap,
    options,
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
    return refusal("PROVIDER_ERROR", "AI explanation unavailable", { message: String(error) });
  }

  const finalConfidence = Math.max(0, Math.min(100, confidence + aiExplanation.confidenceAdjustment));
  recommendation = {
    ...recommendation,
    confidenceScore: finalConfidence,
    riskFactors: [
      "Volatility risk",
      "Liquidity risk",
      earnings.earningsRisk ? "Earnings event risk (<7 days)" : "No immediate earnings event",
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
