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

function inferRatingConsensus(point: RecommendationTrendPoint | null) {
  if (!point) return "unavailable";
  const strongBuy = point.strongBuy ?? 0;
  const buy = point.buy ?? 0;
  const hold = point.hold ?? 0;
  const sell = point.sell ?? 0;
  const strongSell = point.strongSell ?? 0;

  const bullish = strongBuy + buy;
  const bearish = sell + strongSell;

  if (bullish > hold && bullish > bearish) return "bullish";
  if (bearish > hold && bearish > bullish) return "bearish";
  if (hold > bullish && hold > bearish) return "neutral";
  return "mixed";
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

    const latestRecommendation = recommendations.length
      ? [...recommendations].sort((a, b) => periodSort(a.period, b.period)).at(-1) ?? null
      : null;

    const analystCount = latestRecommendation
      ? (latestRecommendation.buy ?? 0) +
        (latestRecommendation.hold ?? 0) +
        (latestRecommendation.sell ?? 0) +
        (latestRecommendation.strongBuy ?? 0) +
        (latestRecommendation.strongSell ?? 0)
      : null;

    const forwardEpsGrowth = computeForwardGrowth(
      epsEstimates.map((p) => ({ period: p.period, value: safeNumber(p.epsAvg) })),
    );
    const forwardRevenueGrowth = computeForwardGrowth(
      revenueEstimates.map((p) => ({ period: p.period, value: safeNumber(p.revenueAvg) })),
    );

    const anyData =
      recommendations.length > 0 ||
      safeNumber(priceTarget.targetMean) != null ||
      epsEstimates.length > 0 ||
      revenueEstimates.length > 0;

    const snapshot: ConsensusSnapshot = {
      enabled: true,
      available: anyData,
      source: "finnhub",
      notes: anyData
        ? undefined
        : "No consensus payload returned from configured provider endpoints",
      forwardRevenueGrowthPct:
        forwardRevenueGrowth != null ? clamp(forwardRevenueGrowth, -200, 200) : undefined,
      forwardEpsGrowthPct: forwardEpsGrowth != null ? clamp(forwardEpsGrowth, -200, 200) : undefined,
      analystCount: analystCount != null ? analystCount : undefined,
      targetMean: safeNumber(priceTarget.targetMean) ?? undefined,
      targetHigh: safeNumber(priceTarget.targetHigh) ?? undefined,
      targetLow: safeNumber(priceTarget.targetLow) ?? undefined,
      ratingConsensus: inferRatingConsensus(latestRecommendation),
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
