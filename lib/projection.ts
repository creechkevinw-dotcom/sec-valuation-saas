import type { FinancialYear, ProjectionYear } from "@/types/valuation";

function cagr(start: number, end: number, years: number) {
  if (start <= 0 || end <= 0 || years <= 0) {
    return 0.03;
  }
  return Math.pow(end / start, 1 / years) - 1;
}

export function projectFinancials(
  history: FinancialYear[],
  yearsToProject = 5,
): ProjectionYear[] {
  const latest = history[history.length - 1];
  const first = history[0];

  if (!latest || !first) {
    return [];
  }

  const baseGrowth = Math.max(-0.05, Math.min(0.2, cagr(first.revenue, latest.revenue, history.length - 1)));
  const currentMargin = latest.revenue > 0 ? latest.fcf / latest.revenue : 0.1;
  const historicalMargins = history
    .map((row) => (row.revenue > 0 ? row.fcf / row.revenue : 0))
    .filter((margin) => Number.isFinite(margin))
    .sort((a, b) => a - b);
  const medianMargin =
    historicalMargins.length > 0
      ? historicalMargins[Math.floor(historicalMargins.length / 2)]
      : currentMargin;
  const capexIntensity = latest.revenue > 0 ? latest.capex / latest.revenue : 0.04;
  const rAndDIntensity = latest.revenue > 0 ? latest.rAndD / latest.revenue : 0.03;
  const sbcIntensity = latest.revenue > 0 ? latest.stockBasedComp / latest.revenue : 0.01;
  const qualityAdjustment =
    Math.max(-0.02, Math.min(0.03, rAndDIntensity * 0.25 - capexIntensity * 0.1 - sbcIntensity * 0.2));
  // If current FCF margin is materially below history (e.g. capex cycle), allow partial deterministic rebound.
  const capexCycleRecovery =
    currentMargin + 0.03 < medianMargin
      ? Math.min(0.05, (medianMargin - currentMargin) * 0.6)
      : 0;
  const targetMargin = Math.max(
    0.04,
    Math.min(0.38, currentMargin + 0.02 + qualityAdjustment + capexCycleRecovery),
  );

  const projected: ProjectionYear[] = [];
  let revenue = latest.revenue;

  for (let i = 1; i <= yearsToProject; i += 1) {
    const year = latest.year + i;
    const fade = 1 - (i - 1) / yearsToProject;
    const growth = baseGrowth * (0.7 + 0.3 * fade) + qualityAdjustment * 0.35;
    const margin = currentMargin + (targetMargin - currentMargin) * (i / yearsToProject);
    revenue *= 1 + growth;

    projected.push({
      year,
      revenue,
      fcf: revenue * margin,
      fcfMargin: margin,
    });
  }

  return projected;
}
