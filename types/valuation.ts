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
