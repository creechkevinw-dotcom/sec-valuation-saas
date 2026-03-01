import type { DeterministicRecommendation, DeterministicSignal, EarningsSnapshot, MarketSnapshot, OptionsSnapshot, TechnicalSnapshot, TradeLeg } from "@/lib/trade/types";

export function liquidityGate(args: {
  avgDailyDollarVolume: number;
  marketCap: number | null;
  options: OptionsSnapshot;
  technical: TechnicalSnapshot;
  market: MarketSnapshot;
}) {
  const { avgDailyDollarVolume, marketCap, options, technical, market } = args;
  if (avgDailyDollarVolume < 10_000_000) {
    return { ok: false, reason: "Avg daily dollar volume below threshold" };
  }
  if (marketCap != null && marketCap < 1_000_000_000) {
    return { ok: false, reason: "Market cap below threshold" };
  }
  if (!options.liquid || options.totalOi < 1000 || (options.avgSpreadPct ?? 999) > 5) {
    return { ok: false, reason: "Options liquidity below threshold" };
  }
  if (technical.atr14 / Math.max(market.price, 1) > 0.25) {
    return { ok: false, reason: "ATR too high relative to price" };
  }
  return { ok: true };
}

function makeLeg(direction: "long" | "short", entry: number, atr: number): TradeLeg {
  const stopDistance = Math.max(atr, entry * 0.01);
  if (direction === "long") {
    const stop = entry - stopDistance;
    const target = entry + stopDistance * 2;
    return { direction, entry, stop, target, rewardRisk: (target - entry) / (entry - stop), thesis: "Trend + fundamentals aligned long bias." };
  }
  const stop = entry + stopDistance;
  const target = entry - stopDistance * 2;
  return { direction, entry, stop, target, rewardRisk: (entry - target) / (stop - entry), thesis: "Weak trend + fundamentals aligned short bias." };
}

export function buildDeterministicRecommendation(args: {
  signal: DeterministicSignal;
  market: MarketSnapshot;
  technical: TechnicalSnapshot;
  earnings: EarningsSnapshot;
}): DeterministicRecommendation {
  const { signal, market, technical, earnings } = args;
  const shortDirection = signal.bias === "mixed" ? null : signal.bias;

  let shortTermTrade: TradeLeg | null = null;
  if (shortDirection) {
    shortTermTrade = makeLeg(shortDirection, market.price, technical.atr14);
  }

  let longTermTrade: TradeLeg | null = null;
  if (signal.bias === "long") {
    longTermTrade = makeLeg("long", market.price, technical.atr14 * 1.5);
  } else if (signal.bias === "short") {
    longTermTrade = makeLeg("short", market.price, technical.atr14 * 1.5);
  }

  let optionsStrategy: string | null = null;
  if (signal.bias === "long") {
    optionsStrategy = earnings.sameWeek
      ? "If trading earnings week, prefer defined-risk volatility structures only."
      : "Bull call spread with liquid strikes and tight spread.";
  } else if (signal.bias === "short") {
    optionsStrategy = earnings.sameWeek
      ? "If trading earnings week, prefer defined-risk volatility structures only."
      : "Bear put spread with liquid strikes and tight spread.";
  }

  return {
    shortTermTrade,
    longTermTrade,
    optionsStrategy,
    riskFactors: [],
    confidenceScore: 0,
    confidenceAdjustmentMax: 5,
  };
}

export function validateRiskReward(rec: DeterministicRecommendation) {
  const legs = [rec.shortTermTrade, rec.longTermTrade].filter((x): x is TradeLeg => x !== null);
  for (const leg of legs) {
    const stopDistance = Math.abs(leg.entry - leg.stop);
    const rewardDistance = Math.abs(leg.target - leg.entry);
    const rr = rewardDistance / Math.max(stopDistance, 1e-9);
    if (rr < 2) {
      return { ok: false, reason: "Reward/risk below 2:1" };
    }
    if (leg.direction === "long" && !(leg.target > leg.entry && leg.stop < leg.entry)) {
      return { ok: false, reason: "Invalid long trade geometry" };
    }
    if (leg.direction === "short" && !(leg.target < leg.entry && leg.stop > leg.entry)) {
      return { ok: false, reason: "Invalid short trade geometry" };
    }
  }
  return { ok: true };
}
