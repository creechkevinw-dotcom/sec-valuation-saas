import { SEC_BASE_URL, SEC_USER_AGENT } from "@/lib/env";

type SecCompanyTicker = {
  ticker: string;
  cik_str: number;
  title: string;
};

type CompanyFactPoint = {
  end?: string;
  val: number;
  fy?: number;
};

type FactUnits = {
  [unit: string]: CompanyFactPoint[];
};

type CompanyFactsResponse = {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, { units: FactUnits }>;
  };
};

const FIELDS = {
  revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"],
  ebit: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss"],
  cfo: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  debt: ["LongTermDebt", "LongTermDebtAndFinanceLeaseObligations"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  shares: ["CommonStockSharesOutstanding", "EntityCommonStockSharesOutstanding"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  inventory: ["InventoryNet", "InventoryFinishedGoods"],
  interestExpense: ["InterestExpense"],
  rAndD: ["ResearchAndDevelopmentExpense"],
  stockBasedComp: ["ShareBasedCompensation"],
  shortTermDebt: ["ShortTermBorrowings", "DebtCurrent"],
  currentLongTermDebt: ["LongTermDebtCurrent"],
  shareholderEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
} as const;

function headers() {
  return {
    "User-Agent": SEC_USER_AGENT,
    Accept: "application/json",
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`SEC fetch failed (${res.status}) for ${url}`);
  }
  return (await res.json()) as T;
}

export async function resolveTicker(ticker: string) {
  const normalized = ticker.trim().toUpperCase();
  const map = await fetchJson<Record<string, SecCompanyTicker>>(
    "https://www.sec.gov/files/company_tickers.json",
  );

  const match = Object.values(map).find((entry) => entry.ticker === normalized);
  if (!match) {
    throw new Error(`Ticker not found: ${normalized}`);
  }

  return {
    ticker: normalized,
    cik: String(match.cik_str).padStart(10, "0"),
    companyName: match.title,
  };
}

export async function fetchCompanyFacts(cik: string): Promise<CompanyFactsResponse> {
  return fetchJson<CompanyFactsResponse>(`${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`);
}

export function extractYearlySeries(
  facts: CompanyFactsResponse,
  fieldNames: readonly string[],
): Map<number, number> {
  const entries: CompanyFactPoint[] = [];
  const usGaap = facts.facts["us-gaap"] ?? {};

  for (const field of fieldNames) {
    const fact = usGaap[field];
    if (!fact) {
      continue;
    }
    for (const unit of Object.keys(fact.units)) {
      entries.push(...fact.units[unit]);
    }
  }

  const yearly = new Map<number, number>();
  for (const row of entries) {
    const year = row.fy ?? (row.end ? new Date(row.end).getUTCFullYear() : undefined);
    if (!year || !Number.isFinite(row.val)) {
      continue;
    }
    const prior = yearly.get(year);
    if (prior === undefined || Math.abs(row.val) > Math.abs(prior)) {
      yearly.set(year, row.val);
    }
  }

  return yearly;
}

export const SEC_FIELDS = FIELDS;
