import { normalizeFinancials } from "@/lib/financial-parser";
import { fetchCompanyFacts, resolveTicker } from "@/lib/sec";
import { fetchLatestFilings } from "@/lib/sec-filings";
import { projectFinancials } from "@/lib/projection";
import { scoreFinancialHealth } from "@/lib/scoring";
import { buildSensitivityTable, runDCF } from "@/lib/dcf";
import type { ValuationReport } from "@/types/valuation";

export async function buildValuationReport(ticker: string): Promise<ValuationReport> {
  const resolved = await resolveTicker(ticker);
  const facts = await fetchCompanyFacts(resolved.cik);
  const filings = await fetchLatestFilings(resolved.cik);
  const history = normalizeFinancials(facts);

  if (history.length < 3) {
    throw new Error("Insufficient SEC history to run valuation");
  }

  const { score, breakdown } = scoreFinancialHealth(history);
  const projections = projectFinancials(history, 5);

  const latest = history[history.length - 1];
  const dcf = runDCF({
    projections,
    cash: latest.cash,
    debt: latest.totalDebt,
    sharesOutstanding: latest.sharesOutstanding,
  });

  const sensitivity = buildSensitivityTable(
    {
      projections,
      cash: latest.cash,
      debt: latest.totalDebt,
      sharesOutstanding: latest.sharesOutstanding,
    },
    dcf.base.wacc,
    dcf.base.terminalGrowth,
  );

  return {
    ticker: resolved.ticker,
    cik: resolved.cik,
    companyName: facts.entityName || resolved.companyName,
    healthScore: score,
    healthBreakdown: breakdown,
    history,
    projections,
    dcf: {
      ...dcf,
      sensitivity,
    },
    filings,
    dataQuality: {
      historyYears: history.length,
      has10K: Boolean(filings.latest10K),
      has10Q: Boolean(filings.latest10Q),
      score: Math.round(
        Math.min(
          100,
          history.length * 15 + (filings.latest10K ? 20 : 0) + (filings.latest10Q ? 20 : 0),
        ),
      ),
    },
    generatedAt: new Date().toISOString(),
  };
}
