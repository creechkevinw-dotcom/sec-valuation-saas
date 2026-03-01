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
  const targetMargin = Math.max(0.05, Math.min(0.35, currentMargin + 0.02));

  const projected: ProjectionYear[] = [];
  let revenue = latest.revenue;

  for (let i = 1; i <= yearsToProject; i += 1) {
    const year = latest.year + i;
    const fade = 1 - (i - 1) / yearsToProject;
    const growth = baseGrowth * (0.7 + 0.3 * fade);
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
