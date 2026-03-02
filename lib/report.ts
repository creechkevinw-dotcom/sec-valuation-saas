import { normalizeFinancials } from "@/lib/financial-parser";
import { extractFilingSections } from "@/lib/filing-sections";
import { getConsensusForTicker } from "@/lib/consensus/provider";
import { fetchCompanyFacts, resolveTicker } from "@/lib/sec";
import { fetchLatestFilings } from "@/lib/sec-filings";
import { projectFinancials } from "@/lib/projection";
import { scoreFinancialHealth } from "@/lib/scoring";
import { buildSensitivityTable, runDCF } from "@/lib/dcf";
import type { ValuationReport } from "@/types/valuation";

function clamp(value: number, min = -999_999, max = 999_999) {
  return Math.max(min, Math.min(max, value));
}

function computeEnrichment(reportHistory: ValuationReport["history"]) {
  const latest = reportHistory[reportHistory.length - 1];
  if (!latest) {
    return {
      liquidity: {
        currentRatio: 0,
        quickRatio: 0,
        interestCoverage: 0,
        debtToFcf: null,
        cashToDebt: 0,
      },
      intensity: {
        capexToRevenue: 0,
        rAndDToRevenue: 0,
        sbcToRevenue: 0,
        fcfMargin: 0,
      },
    };
  }

  return {
    liquidity: {
      currentRatio: latest.currentLiabilities > 0 ? latest.currentAssets / latest.currentLiabilities : 0,
      quickRatio:
        latest.currentLiabilities > 0
          ? (latest.currentAssets - latest.inventory) / latest.currentLiabilities
          : 0,
      interestCoverage: latest.interestExpense > 0 ? latest.ebit / latest.interestExpense : 0,
      debtToFcf: latest.fcf > 0 ? latest.totalDebt / latest.fcf : null,
      cashToDebt: latest.totalDebt > 0 ? latest.cash / latest.totalDebt : 0,
    },
    intensity: {
      capexToRevenue: latest.revenue > 0 ? latest.capex / latest.revenue : 0,
      rAndDToRevenue: latest.revenue > 0 ? latest.rAndD / latest.revenue : 0,
      sbcToRevenue: latest.revenue > 0 ? latest.stockBasedComp / latest.revenue : 0,
      fcfMargin: latest.revenue > 0 ? latest.fcf / latest.revenue : 0,
    },
  };
}

function governanceSignalsFromSections(sections: {
  latest10kRiskFactors?: string | null;
  latest10qRiskFactors?: string | null;
  latest10kMdna?: string | null;
}) {
  const corpus = `${sections.latest10kRiskFactors ?? ""} ${sections.latest10qRiskFactors ?? ""} ${sections.latest10kMdna ?? ""}`.toLowerCase();
  const signals: string[] = [];

  if (corpus.includes("cybersecurity")) signals.push("Cybersecurity risk explicitly disclosed");
  if (corpus.includes("regulation") || corpus.includes("regulatory")) signals.push("Regulatory risk language present");
  if (corpus.includes("competition")) signals.push("Competitive pressure highlighted in filings");
  if (corpus.includes("supply chain")) signals.push("Supply-chain dependency risk referenced");
  if (signals.length === 0) signals.push("No major governance/risk keyword extracted from sampled sections");

  return signals.slice(0, 5);
}

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
  const [sections, consensus] = await Promise.all([
    extractFilingSections({ latest10K: filings.latest10K, latest10Q: filings.latest10Q }),
    getConsensusForTicker(resolved.ticker),
  ]);

  const latest = history[history.length - 1];
  const enrichmentBase = computeEnrichment(history);
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
    enrichment: {
      liquidity: {
        currentRatio: clamp(enrichmentBase.liquidity.currentRatio),
        quickRatio: clamp(enrichmentBase.liquidity.quickRatio),
        interestCoverage: clamp(enrichmentBase.liquidity.interestCoverage),
        debtToFcf:
          enrichmentBase.liquidity.debtToFcf != null
            ? clamp(enrichmentBase.liquidity.debtToFcf)
            : null,
        cashToDebt: clamp(enrichmentBase.liquidity.cashToDebt),
      },
      intensity: {
        capexToRevenue: clamp(enrichmentBase.intensity.capexToRevenue),
        rAndDToRevenue: clamp(enrichmentBase.intensity.rAndDToRevenue),
        sbcToRevenue: clamp(enrichmentBase.intensity.sbcToRevenue),
        fcfMargin: clamp(enrichmentBase.intensity.fcfMargin),
      },
      filingSections: sections,
      consensus,
      governanceSignals: governanceSignalsFromSections(sections),
    },
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
