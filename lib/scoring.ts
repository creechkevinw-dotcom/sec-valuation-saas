import type { FinancialYear, HealthBreakdown } from "@/types/valuation";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function scoreFinancialHealth(history: FinancialYear[]): {
  score: number;
  breakdown: HealthBreakdown;
} {
  const latest = history[history.length - 1];
  const first = history[0];

  if (!latest || !first) {
    return {
      score: 0,
      breakdown: {
        profitability: 0,
        leverage: 0,
        liquidity: 0,
        growth: 0,
        cashConversion: 0,
      },
    };
  }

  const profitabilityMargin = latest.revenue > 0 ? latest.netIncome / latest.revenue : 0;
  const leverageRatio = latest.revenue > 0 ? latest.totalDebt / latest.revenue : 0;
  const liquidityRatio = latest.totalDebt > 0 ? latest.cash / latest.totalDebt : 1;
  const currentRatio =
    latest.currentLiabilities > 0 ? latest.currentAssets / latest.currentLiabilities : 1;
  const quickRatio =
    latest.currentLiabilities > 0
      ? (latest.currentAssets - latest.inventory) / latest.currentLiabilities
      : 1;
  const interestCoverage =
    latest.interestExpense > 0 ? latest.ebit / latest.interestExpense : latest.ebit > 0 ? 5 : 0;
  const years = history.length - 1;
  const growthRate = years > 0 && first.revenue > 0
    ? Math.pow(latest.revenue / first.revenue, 1 / years) - 1
    : 0;
  const cashConversionRate = latest.netIncome !== 0 ? latest.fcf / latest.netIncome : 0;

  const breakdown: HealthBreakdown = {
    profitability: clamp((profitabilityMargin + 0.05) * 500),
    leverage: clamp((1.5 - leverageRatio) * 60),
    liquidity: clamp(liquidityRatio * 20 + currentRatio * 18 + quickRatio * 12 + interestCoverage * 5),
    growth: clamp((growthRate + 0.05) * 400),
    cashConversion: clamp(cashConversionRate * 60),
  };

  const weighted =
    breakdown.profitability * 0.3 +
    breakdown.leverage * 0.2 +
    breakdown.liquidity * 0.15 +
    breakdown.growth * 0.2 +
    breakdown.cashConversion * 0.15;

  return {
    score: Math.round(clamp(weighted)),
    breakdown,
  };
}
