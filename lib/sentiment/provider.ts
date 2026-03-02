import { getNewsForTicker } from "@/lib/news/provider";

export type SentimentSnapshot = {
  enabled: boolean;
  available: boolean;
  ticker: string;
  score: number;
  label: "bullish" | "neutral" | "bearish";
  trend: "up" | "flat" | "down";
  confidence: number;
  articleCount: number;
  sourceCount: number;
  topHeadlines: Array<{
    title: string;
    source: string;
    publishedAt: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
  updatedAt: string;
  reason?: string;
};

const CACHE_TTL_MS = 6 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; value: SentimentSnapshot }>();

const POSITIVE_TERMS = [
  "beat",
  "upgrade",
  "outperform",
  "growth",
  "record",
  "strong",
  "surge",
  "expands",
  "raises",
  "profit",
  "wins",
  "bullish",
  "buyback",
];

const NEGATIVE_TERMS = [
  "miss",
  "downgrade",
  "underperform",
  "decline",
  "weak",
  "fall",
  "lawsuit",
  "probe",
  "risk",
  "cuts",
  "layoff",
  "bearish",
  "antitrust",
  "warning",
];

function scoreText(text: string) {
  const normalized = text.toLowerCase();
  let score = 0;
  for (const token of POSITIVE_TERMS) {
    if (normalized.includes(token)) score += 1;
  }
  for (const token of NEGATIVE_TERMS) {
    if (normalized.includes(token)) score -= 1;
  }
  return score;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toLabel(score: number): "bullish" | "neutral" | "bearish" {
  if (score >= 12) return "bullish";
  if (score <= -12) return "bearish";
  return "neutral";
}

function toArticleSentiment(score: number): "positive" | "neutral" | "negative" {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function trendFromHalves(scores: number[]): "up" | "flat" | "down" {
  if (scores.length < 4) return "flat";
  const mid = Math.floor(scores.length / 2);
  const older = scores.slice(0, mid);
  const newer = scores.slice(mid);
  const olderAvg = older.reduce((sum, value) => sum + value, 0) / Math.max(1, older.length);
  const newerAvg = newer.reduce((sum, value) => sum + value, 0) / Math.max(1, newer.length);
  const delta = newerAvg - olderAvg;
  if (delta > 0.3) return "up";
  if (delta < -0.3) return "down";
  return "flat";
}

export async function getSentimentForTicker(ticker: string): Promise<SentimentSnapshot> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `sentiment:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const news = await getNewsForTicker(symbol);
  if (!news.enabled) {
    const snapshot: SentimentSnapshot = {
      enabled: false,
      available: false,
      ticker: symbol,
      score: 0,
      label: "neutral",
      trend: "flat",
      confidence: 0,
      articleCount: 0,
      sourceCount: 0,
      topHeadlines: [],
      updatedAt: new Date().toISOString(),
      reason: news.reason ?? "NEWS_ENABLED is false",
    };
    cache.set(cacheKey, { value: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    return snapshot;
  }

  if (!news.available || news.items.length === 0) {
    const snapshot: SentimentSnapshot = {
      enabled: true,
      available: false,
      ticker: symbol,
      score: 0,
      label: "neutral",
      trend: "flat",
      confidence: 0,
      articleCount: 0,
      sourceCount: 0,
      topHeadlines: [],
      updatedAt: new Date().toISOString(),
      reason: news.reason ?? "No news available for sentiment scoring",
    };
    cache.set(cacheKey, { value: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    return snapshot;
  }

  const sorted = [...news.items].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const articleScores = sorted.map((item) => scoreText(`${item.title} ${item.summary ?? ""}`));
  const raw = articleScores.reduce((sum, value) => sum + value, 0);
  const normalizedScore = clamp((raw / Math.max(1, sorted.length)) * 20, -100, 100);
  const sourceCount = new Set(sorted.map((item) => item.source)).size;
  const confidence = clamp(
    Math.min(100, sorted.length * 6 + sourceCount * 5 + Math.abs(normalizedScore) * 0.25),
    20,
    100,
  );

  const topHeadlines = [...sorted]
    .reverse()
    .slice(0, 5)
    .map((item) => {
      const itemScore = scoreText(`${item.title} ${item.summary ?? ""}`);
      return {
        title: item.title,
        source: item.source,
        publishedAt: item.publishedAt,
        sentiment: toArticleSentiment(itemScore),
      };
    });

  const snapshot: SentimentSnapshot = {
    enabled: true,
    available: true,
    ticker: symbol,
    score: Number(normalizedScore.toFixed(1)),
    label: toLabel(normalizedScore),
    trend: trendFromHalves(articleScores),
    confidence: Number(confidence.toFixed(0)),
    articleCount: sorted.length,
    sourceCount,
    topHeadlines,
    updatedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { value: snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
  return snapshot;
}
