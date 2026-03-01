import type {
  DeterministicSignal,
  FundamentalSnapshot,
  MarketSnapshot,
  OptionsSnapshot,
  TechnicalSnapshot,
} from "@/lib/trade/types";

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function computeSignal(args: {
  technical: TechnicalSnapshot;
  market: MarketSnapshot;
  fundamentals: FundamentalSnapshot;
  options: OptionsSnapshot;
}): DeterministicSignal {
  const { technical, market, fundamentals, options } = args;
  const trendScore =
    (technical.lastClose > technical.sma50 ? 20 : -20) +
    (technical.sma50 > technical.sma200 ? 20 : -20) +
    (technical.macd > 0 ? 10 : -10) +
    (technical.rsi14 > 50 ? 10 : -10);
  const technicalScore = clamp(50 + trendScore);

  const valuationSupport =
    fundamentals.baseFairValue && market.price > 0
      ? ((fundamentals.baseFairValue - market.price) / market.price) * 100
      : 0;
  const fundamentalScore = clamp(
    0.7 * fundamentals.healthScore + (valuationSupport > 10 ? 25 : valuationSupport < -10 ? -15 : 5),
  );

  const momentumScore = clamp(technical.momentumScore);
  const volatilityScore = clamp(100 - (technical.atr14 / Math.max(market.price, 1)) * 300);
  const liquidityScore = clamp(
    (market.spreadPct < 0.5 ? 40 : market.spreadPct < 1 ? 25 : 10) +
      (fundamentals.avgDailyDollarVolume > 50_000_000 ? 35 : fundamentals.avgDailyDollarVolume > 10_000_000 ? 20 : 5) +
      (options.liquid ? 25 : 10),
  );

  let bias: "long" | "short" | "mixed" = "mixed";
  if (technicalScore > 60 && fundamentalScore > 60) {
    bias = "long";
  } else if (technicalScore < 40 && fundamentalScore < 50) {
    bias = "short";
  }

  return {
    technicalScore,
    fundamentalScore,
    momentumScore,
    volatilityScore,
    liquidityScore,
    bias,
  };
}

export function composeConfidence(signal: DeterministicSignal): number {
  return clamp(
    signal.technicalScore * 0.35 +
      signal.fundamentalScore * 0.35 +
      signal.liquidityScore * 0.15 +
      signal.momentumScore * 0.15,
  );
}
