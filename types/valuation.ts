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
  generatedAt: string;
};
