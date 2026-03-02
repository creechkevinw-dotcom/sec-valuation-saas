export type PlanTier = "free" | "pro";

export type FinancialYear = {
  year: number;
  revenue: number;
  ebit: number;
  netIncome: number;
  fcf: number;
  totalDebt: number;
  cash: number;
  sharesOutstanding: number;
  currentAssets: number;
  currentLiabilities: number;
  inventory: number;
  interestExpense: number;
  capex: number;
  rAndD: number;
  stockBasedComp: number;
  shortTermDebt: number;
  currentLongTermDebt: number;
  shareholderEquity: number;
  bookValuePerShare: number;
};

export type HealthBreakdown = {
  profitability: number;
  leverage: number;
  liquidity: number;
  growth: number;
  cashConversion: number;
};

export type ProjectionYear = {
  year: number;
  revenue: number;
  fcf: number;
  fcfMargin: number;
};

export type ScenarioName = "base" | "bull" | "bear";

export type DcfScenarioResult = {
  scenario: ScenarioName;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  wacc: number;
  terminalGrowth: number;
};

export type SensitivityCell = {
  wacc: number;
  terminalGrowth: number;
  fairValuePerShare: number;
};

export type FilingDocument = {
  form: string;
  accessionNumber: string;
  filingDate: string;
  reportDate?: string | null;
  primaryDocument: string;
  primaryDocDescription?: string;
  documentUrl: string;
  filingFolderUrl: string;
};

export type ValuationReport = {
  ticker: string;
  cik: string;
  companyName: string;
  healthScore: number;
  healthBreakdown: HealthBreakdown;
  history: FinancialYear[];
  projections: ProjectionYear[];
  dcf: {
    base: DcfScenarioResult;
    bull: DcfScenarioResult;
    bear: DcfScenarioResult;
    sensitivity: SensitivityCell[];
  };
  filings: {
    latest10K: FilingDocument | null;
    latest10Q: FilingDocument | null;
    recent10k10q: FilingDocument[];
  };
  enrichment: {
    liquidity: {
      currentRatio: number;
      quickRatio: number;
      interestCoverage: number;
      debtToFcf: number | null;
      cashToDebt: number;
    };
    intensity: {
      capexToRevenue: number;
      rAndDToRevenue: number;
      sbcToRevenue: number;
      fcfMargin: number;
    };
    leverage: {
      debtToEquity: number | null;
      shortDebtPct: number | null;
      currentMaturityDebtPct: number | null;
      bookValuePerShare: number;
    };
    segmentMetrics: {
      latest10kSegmentRevenueMentions: number;
      latest10kSegmentOperatingIncomeMentions: number;
      latest10qSegmentRevenueMentions: number;
      latest10qSegmentOperatingIncomeMentions: number;
    };
    filingSections: {
      latest10kMdna?: string | null;
      latest10kRiskFactors?: string | null;
      latest10kSegmentNotes?: string | null;
      latest10qMdna?: string | null;
      latest10qRiskFactors?: string | null;
      latest10qSegmentNotes?: string | null;
    };
    consensus: {
      enabled: boolean;
      available: boolean;
      source: string;
      notes?: string;
      forwardRevenueGrowthPct?: number;
      forwardEpsGrowthPct?: number;
      analystCount?: number;
      targetMean?: number;
      targetHigh?: number;
      targetLow?: number;
      ratingConsensus?: string;
      ratingScore?: number;
      ratingsBreakdown?: {
        strongBuy: number;
        buy: number;
        hold: number;
        sell: number;
        strongSell: number;
      };
      revisionTrend?: "up" | "down" | "flat";
      updatedAt?: string;
    };
    governanceSignals: string[];
    deterministicMissingData: string[];
  };
  dataQuality: {
    historyYears: number;
    has10K: boolean;
    has10Q: boolean;
    score: number;
  };
  generatedAt: string;
};

export type AiCompanyAnalysis = {
  conviction: "low" | "medium" | "high";
  conviction_reasoning: string[];
  profitability_summary: string;
  growth_summary: string;
  cash_flow_summary: string;
  balance_sheet_summary: string;
  liquidity_summary: string;
  risks: string[];
  strengths: string[];
  what_would_change_view: string[];
  trade_scenarios: string[];
  missing_data: string[];
  disclaimer: string;
};
