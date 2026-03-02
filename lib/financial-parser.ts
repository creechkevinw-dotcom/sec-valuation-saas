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
  const longTermDebt = extractYearlySeries(facts, SEC_FIELDS.debt);
  const cash = extractYearlySeries(facts, SEC_FIELDS.cash);
  const shortTermInvestments = extractYearlySeries(facts, SEC_FIELDS.shortTermInvestments);
  const shares = extractYearlySeries(facts, SEC_FIELDS.shares);
  const currentAssets = extractYearlySeries(facts, SEC_FIELDS.currentAssets);
  const currentLiabilities = extractYearlySeries(facts, SEC_FIELDS.currentLiabilities);
  const inventory = extractYearlySeries(facts, SEC_FIELDS.inventory);
  const interestExpense = extractYearlySeries(facts, SEC_FIELDS.interestExpense);
  const rAndD = extractYearlySeries(facts, SEC_FIELDS.rAndD);
  const stockBasedComp = extractYearlySeries(facts, SEC_FIELDS.stockBasedComp);
  const shortTermDebt = extractYearlySeries(facts, SEC_FIELDS.shortTermDebt);
  const currentLongTermDebt = extractYearlySeries(facts, SEC_FIELDS.currentLongTermDebt);
  const shareholderEquity = extractYearlySeries(facts, SEC_FIELDS.shareholderEquity);

  const years = [...revenue.keys()].sort((a, b) => a - b).slice(-5);
  return years.map((year) => {
    const operatingCashFlow = safeValue(cfo.get(year));
    const capexValue = Math.abs(safeValue(capex.get(year)));
    const sharesOutstanding = Math.max(1, safeValue(shares.get(year)));
    const longDebt = Math.abs(safeValue(longTermDebt.get(year)));
    const shortDebt = Math.abs(safeValue(shortTermDebt.get(year)));
    const currentDebtMaturity = Math.abs(safeValue(currentLongTermDebt.get(year)));
    const totalDebt = longDebt + shortDebt + currentDebtMaturity;
    const cashAndInvestments =
      safeValue(cash.get(year)) + Math.abs(safeValue(shortTermInvestments.get(year)));
    const equityValue = safeValue(shareholderEquity.get(year));

    return {
      year,
      revenue: safeValue(revenue.get(year)),
      ebit: safeValue(ebit.get(year)),
      netIncome: safeValue(netIncome.get(year)),
      fcf: operatingCashFlow - capexValue,
      totalDebt,
      cash: cashAndInvestments,
      sharesOutstanding,
      currentAssets: safeValue(currentAssets.get(year)),
      currentLiabilities: safeValue(currentLiabilities.get(year)),
      inventory: safeValue(inventory.get(year)),
      interestExpense: Math.abs(safeValue(interestExpense.get(year))),
      capex: capexValue,
      rAndD: Math.abs(safeValue(rAndD.get(year))),
      stockBasedComp: Math.abs(safeValue(stockBasedComp.get(year))),
      shortTermDebt: Math.abs(safeValue(shortTermDebt.get(year))),
      currentLongTermDebt: Math.abs(safeValue(currentLongTermDebt.get(year))),
      shareholderEquity: equityValue,
      bookValuePerShare: sharesOutstanding > 0 ? equityValue / sharesOutstanding : 0,
    };
  });
}
