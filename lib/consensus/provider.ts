export type ConsensusSnapshot = {
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

export interface ConsensusProvider {
  getConsensus(ticker: string): Promise<ConsensusSnapshot>;
}

type RecommendationTrendPoint = {
  period?: string;
  buy?: number;
  hold?: number;
  sell?: number;
  strongBuy?: number;
  strongSell?: number;
};

type PriceTargetResponse = {
  lastUpdated?: string;
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
};

type YahooQuoteSummary = {
  quoteSummary?: {
    result?: Array<{
      financialData?: {
        targetLowPrice?: { raw?: number };
        targetMeanPrice?: { raw?: number };
        targetHighPrice?: { raw?: number };
      };
    }>;
  };
};

type FmpTargetPoint = Record<string, unknown>;

type EpsEstimatePoint = {
  period?: string;
  epsAvg?: number;
  numberAnalysts?: number;
};

type RevenueEstimatePoint = {
  period?: string;
  revenueAvg?: number;
};

const DAY_MS = 24 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; value: ConsensusSnapshot }>();

function clamp(value: number, min = -1000, max = 1000) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function periodSort(a?: string, b?: string) {
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function computeForwardGrowth(series: Array<{ period?: string; value: number | null }>) {
  const points = series
    .filter((p) => p.value != null && Number.isFinite(p.value))
    .sort((a, b) => periodSort(a.period, b.period));

  if (points.length < 2) return null;

  const latest = points[points.length - 1].value as number;
  const previous = points[points.length - 2].value as number;
  if (previous === 0) return null;

  return ((latest - previous) / Math.abs(previous)) * 100;
}

function computeRating(point: RecommendationTrendPoint | null) {
  const breakdown = {
    strongBuy: point?.strongBuy ?? 0,
    buy: point?.buy ?? 0,
    hold: point?.hold ?? 0,
    sell: point?.sell ?? 0,
    strongSell: point?.strongSell ?? 0,
  };
  const count =
    breakdown.strongBuy + breakdown.buy + breakdown.hold + breakdown.sell + breakdown.strongSell;
  if (count <= 0) {
    return { label: "Unavailable", score: null as number | null, breakdown };
  }

  const weighted =
    breakdown.strongBuy * 5 +
    breakdown.buy * 4 +
    breakdown.hold * 3 +
    breakdown.sell * 2 +
    breakdown.strongSell * 1;
  const score = weighted / count;

  let label = "Hold";
  if (score >= 4.5) label = "Strong Buy";
  else if (score >= 3.8) label = "Buy / Outperform";
  else if (score >= 3.2) label = "Hold";
  else if (score >= 2.4) label = "Underperform";
  else label = "Sell";

  return { label, score, breakdown };
}

function inferRevisionTrend(recentGrowth: number | null) {
  if (recentGrowth == null) return "flat";
  if (recentGrowth > 1) return "up";
  if (recentGrowth < -1) return "down";
  return "flat";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CONSENSUS_HTTP_${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchYahooTargets(symbol: string): Promise<{
  targetLow?: number;
  targetMean?: number;
  targetHigh?: number;
}> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return {};
  }

  const json = (await res.json()) as YahooQuoteSummary;
  const fd = json.quoteSummary?.result?.[0]?.financialData;
  return {
    targetLow: safeNumber(fd?.targetLowPrice?.raw ?? null) ?? undefined,
    targetMean: safeNumber(fd?.targetMeanPrice?.raw ?? null) ?? undefined,
    targetHigh: safeNumber(fd?.targetHighPrice?.raw ?? null) ?? undefined,
  };
}

function pickFirstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const val = safeNumber(record[key]);
    if (val != null) return val;
  }
  return undefined;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
  }
  return undefined;
}

function parseFmpTargets(payload: unknown): {
  targetLow?: number;
  targetMean?: number;
  targetHigh?: number;
  updatedAt?: string;
} {
  const rows = Array.isArray(payload) ? (payload as FmpTargetPoint[]) : [];
  const first = rows[0];
  if (first && typeof first === "object") {
    const directLow = pickFirstNumber(first, [
      "targetLow",
      "target_low",
      "priceTargetLow",
      "priceTargetLowEstimate",
      "low",
    ]);
    const directMean = pickFirstNumber(first, [
      "targetConsensus",
      "targetMean",
      "targetAverage",
      "targetMedian",
      "priceTargetAverage",
      "mean",
    ]);
    const directHigh = pickFirstNumber(first, [
      "targetHigh",
      "target_high",
      "priceTargetHigh",
      "priceTargetHighEstimate",
      "high",
    ]);
    const directUpdated = pickFirstString(first, [
      "lastUpdated",
      "updatedDate",
      "publishedDate",
      "date",
    ]);

    if (directLow != null || directMean != null || directHigh != null) {
      return {
        targetLow: directLow,
        targetMean: directMean,
        targetHigh: directHigh,
        updatedAt: directUpdated,
      };
    }
  }

  const perAnalystTargets = rows
    .map((row) =>
      pickFirstNumber(row, ["target", "targetPrice", "priceTarget", "priceTargetValue", "priceTargetAvg"]),
    )
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);

  if (perAnalystTargets.length > 0) {
    const low = Math.min(...perAnalystTargets);
    const high = Math.max(...perAnalystTargets);
    const mean = perAnalystTargets.reduce((sum, value) => sum + value, 0) / perAnalystTargets.length;
    return {
      targetLow: low,
      targetMean: mean,
      targetHigh: high,
    };
  }

  return {};
}

async function fetchFmpTargets(symbol: string): Promise<{
  targetLow?: number;
  targetMean?: number;
  targetHigh?: number;
  updatedAt?: string;
}> {
  const key = process.env.FMP_API_KEY ?? process.env.FINANCIAL_MODELING_PREP_API_KEY;
  if (!key) return {};

  const candidateUrls = [
    `https://financialmodelingprep.com/api/v4/price-target-consensus?symbol=${symbol}&apikey=${key}`,
    `https://financialmodelingprep.com/api/v3/price-target-consensus?symbol=${symbol}&apikey=${key}`,
    `https://financialmodelingprep.com/api/v4/price-target?symbol=${symbol}&apikey=${key}`,
    `https://financialmodelingprep.com/api/v3/price-target?symbol=${symbol}&apikey=${key}`,
  ];

  for (const url of candidateUrls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      continue;
    }

    const parsed = parseFmpTargets(await res.json());
    if (parsed.targetLow != null || parsed.targetMean != null || parsed.targetHigh != null) {
      return parsed;
    }
  }

  return {};
}

class FinnhubConsensusProvider implements ConsensusProvider {
  async getConsensus(ticker: string): Promise<ConsensusSnapshot> {
    const symbol = ticker.trim().toUpperCase();

    const cached = cache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return {
        enabled: true,
        available: false,
        source: "finnhub",
        notes: "FINNHUB_API_KEY is missing",
      };
    }

    const urls = {
      recommendations: `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${key}`,
      priceTarget: `https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${key}`,
      epsEstimate: `https://finnhub.io/api/v1/stock/eps-estimate?symbol=${symbol}&freq=annual&token=${key}`,
      revenueEstimate: `https://finnhub.io/api/v1/stock/revenue-estimate?symbol=${symbol}&freq=annual&token=${key}`,
    };

    const [recommendationsRes, targetRes, epsRes, revenueRes] = await Promise.allSettled([
      fetchJson<RecommendationTrendPoint[]>(urls.recommendations),
      fetchJson<PriceTargetResponse>(urls.priceTarget),
      fetchJson<EpsEstimatePoint[]>(urls.epsEstimate),
      fetchJson<RevenueEstimatePoint[]>(urls.revenueEstimate),
    ]);

    const recommendations = recommendationsRes.status === "fulfilled" ? recommendationsRes.value : [];
    const priceTarget = targetRes.status === "fulfilled" ? targetRes.value : {};
    const epsEstimates = epsRes.status === "fulfilled" ? epsRes.value : [];
    const revenueEstimates = revenueRes.status === "fulfilled" ? revenueRes.value : [];
    const targetFetchError =
      targetRes.status === "rejected"
        ? targetRes.reason instanceof Error
          ? targetRes.reason.message
          : "Price target provider request failed"
        : null;

    const finnhubTargetLow = safeNumber(priceTarget.targetLow) ?? undefined;
    const finnhubTargetMean = safeNumber(priceTarget.targetMean) ?? undefined;
    const finnhubTargetHigh = safeNumber(priceTarget.targetHigh) ?? undefined;

    let targetLow = finnhubTargetLow;
    let targetMean = finnhubTargetMean;
    let targetHigh = finnhubTargetHigh;
    let targetSource = "finnhub";

    if (targetLow == null || targetMean == null || targetHigh == null) {
      const fmpTargets = await fetchFmpTargets(symbol);
      targetLow = targetLow ?? fmpTargets.targetLow;
      targetMean = targetMean ?? fmpTargets.targetMean;
      targetHigh = targetHigh ?? fmpTargets.targetHigh;
      if (fmpTargets.updatedAt && !priceTarget.lastUpdated) {
        priceTarget.lastUpdated = fmpTargets.updatedAt;
      }
      if (fmpTargets.targetLow != null || fmpTargets.targetMean != null || fmpTargets.targetHigh != null) {
        targetSource = "finnhub+fmp";
      }
    }

    if (targetLow == null || targetMean == null || targetHigh == null) {
      const yahooTargets = await fetchYahooTargets(symbol);
      targetLow = targetLow ?? yahooTargets.targetLow;
      targetMean = targetMean ?? yahooTargets.targetMean;
      targetHigh = targetHigh ?? yahooTargets.targetHigh;
      if (yahooTargets.targetLow != null || yahooTargets.targetMean != null || yahooTargets.targetHigh != null) {
        targetSource = targetSource === "finnhub+fmp" ? "finnhub+fmp+yahoo" : "finnhub+yahoo";
      }
    }

    const latestRecommendation = recommendations.length
      ? [...recommendations].sort((a, b) => periodSort(a.period, b.period)).at(-1) ?? null
      : null;

    const rating = computeRating(latestRecommendation);
    const analystCount =
      rating.score != null
        ? rating.breakdown.buy +
          rating.breakdown.hold +
          rating.breakdown.sell +
          rating.breakdown.strongBuy +
          rating.breakdown.strongSell
        : null;

    const forwardEpsGrowth = computeForwardGrowth(
      epsEstimates.map((p) => ({ period: p.period, value: safeNumber(p.epsAvg) })),
    );
    const forwardRevenueGrowth = computeForwardGrowth(
      revenueEstimates.map((p) => ({ period: p.period, value: safeNumber(p.revenueAvg) })),
    );

    const hasTargets = targetMean != null || targetHigh != null || targetLow != null;
    const anyData =
      recommendations.length > 0 ||
      hasTargets ||
      epsEstimates.length > 0 ||
      revenueEstimates.length > 0;

    let notes: string | undefined;
    if (!anyData) {
      notes = "No consensus payload returned from configured provider endpoints";
    } else if (!hasTargets && targetFetchError?.includes("CONSENSUS_HTTP_403")) {
      notes = "Analyst rating is available, but Finnhub price-target endpoint is restricted. Add FMP_API_KEY to enable target fallback.";
    } else if (!hasTargets) {
      notes = "Analyst rating is available, but provider did not return low/mean/high price targets.";
    }

    const snapshot: ConsensusSnapshot = {
      enabled: true,
      available: anyData,
      source: targetSource,
      notes,
      forwardRevenueGrowthPct:
        forwardRevenueGrowth != null ? clamp(forwardRevenueGrowth, -200, 200) : undefined,
      forwardEpsGrowthPct: forwardEpsGrowth != null ? clamp(forwardEpsGrowth, -200, 200) : undefined,
      analystCount: analystCount != null ? analystCount : undefined,
      targetMean,
      targetHigh,
      targetLow,
      ratingConsensus: rating.label,
      ratingScore: rating.score != null ? Number(rating.score.toFixed(2)) : undefined,
      ratingsBreakdown: rating.breakdown,
      revisionTrend: inferRevisionTrend(forwardEpsGrowth),
      updatedAt: priceTarget.lastUpdated,
    };

    cache.set(symbol, { value: snapshot, expiresAt: Date.now() + DAY_MS });
    return snapshot;
  }
}

class DisabledConsensusProvider implements ConsensusProvider {
  async getConsensus(ticker: string): Promise<ConsensusSnapshot> {
    void ticker;
    return {
      enabled: false,
      available: false,
      source: "none",
      notes: "CONSENSUS_ENABLED is false",
    };
  }
}

function createProvider(): ConsensusProvider {
  if (process.env.CONSENSUS_ENABLED === "true") {
    return new FinnhubConsensusProvider();
  }
  return new DisabledConsensusProvider();
}

const provider = createProvider();

export async function getConsensusForTicker(ticker: string) {
  try {
    return await provider.getConsensus(ticker);
  } catch (error) {
    return {
      enabled: process.env.CONSENSUS_ENABLED === "true",
      available: false,
      source: "finnhub",
      notes: error instanceof Error ? error.message : "Consensus provider failure",
    };
  }
}
