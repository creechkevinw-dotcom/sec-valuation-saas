import { extractYearlySeries, SEC_FIELDS } from "@/lib/sec";
import type { FinancialYear } from "@/types/valuation";

type FactsPayload = {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, { units: Record<string, Array<{ end?: string; val: number; fy?: number }> > }>;
  };
};

function safeValue(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

export function normalizeFinancials(facts: FactsPayload): FinancialYear[] {
  const revenue = extractYearlySeries(facts, SEC_FIELDS.revenue);
  const ebit = extractYearlySeries(facts, SEC_FIELDS.ebit);
  const netIncome = extractYearlySeries(facts, SEC_FIELDS.netIncome);
  const cfo = extractYearlySeries(facts, SEC_FIELDS.cfo);
  const capex = extractYearlySeries(facts, SEC_FIELDS.capex);
  const debt = extractYearlySeries(facts, SEC_FIELDS.debt);
  const cash = extractYearlySeries(facts, SEC_FIELDS.cash);
  const shares = extractYearlySeries(facts, SEC_FIELDS.shares);

  const years = [...revenue.keys()].sort((a, b) => a - b).slice(-5);
  return years.map((year) => {
    const operatingCashFlow = safeValue(cfo.get(year));
    const capexValue = Math.abs(safeValue(capex.get(year)));

    return {
      year,
      revenue: safeValue(revenue.get(year)),
      ebit: safeValue(ebit.get(year)),
      netIncome: safeValue(netIncome.get(year)),
      fcf: operatingCashFlow - capexValue,
      totalDebt: safeValue(debt.get(year)),
      cash: safeValue(cash.get(year)),
      sharesOutstanding: Math.max(1, safeValue(shares.get(year))),
    };
  });
}
