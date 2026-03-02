export type NewsItem = {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  summary?: string;
};

export type NewsResult = {
  enabled: boolean;
  available: boolean;
  items: NewsItem[];
  reason?: string;
};

export interface NewsProvider {
  getCompanyNews(ticker: string): Promise<NewsResult>;
}

type FinnhubNewsItem = {
  headline?: string;
  url?: string;
  datetime?: number;
  source?: string;
  summary?: string;
};

const CACHE_TTL_MS = 6 * 60 * 60_000;
const cache = new Map<string, { expiresAt: number; value: NewsResult }>();

class FinnhubNewsProvider implements NewsProvider {
  async getCompanyNews(ticker: string): Promise<NewsResult> {
    const key = process.env.FINNHUB_API_KEY;
    if (!key) {
      return {
        enabled: true,
        available: false,
        items: [],
        reason: "FINNHUB_API_KEY missing for news provider",
      };
    }

    const symbol = ticker.trim().toUpperCase();
    const cacheKey = `news:${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const to = new Date();
    const from = new Date(Date.now() - 14 * 24 * 60 * 60_000);
    const fromDate = from.toISOString().slice(0, 10);
    const toDate = to.toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${toDate}&token=${key}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const value: NewsResult = {
        enabled: true,
        available: false,
        items: [],
        reason: `News provider HTTP ${res.status}`,
      };
      cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    }

    const payload = (await res.json()) as FinnhubNewsItem[];
    const items = payload
      .filter((row) => typeof row.headline === "string" && typeof row.url === "string")
      .slice(0, 30)
      .map((row) => ({
        title: row.headline as string,
        url: row.url as string,
        publishedAt: row.datetime
          ? new Date(row.datetime * 1000).toISOString()
          : new Date().toISOString(),
        source: row.source || "unknown",
        summary: row.summary,
      }));

    const value: NewsResult = {
      enabled: true,
      available: items.length > 0,
      items,
      reason: items.length > 0 ? undefined : "No recent news items returned",
    };
    cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }
}

class DisabledNewsProvider implements NewsProvider {
  async getCompanyNews(ticker: string): Promise<NewsResult> {
    void ticker;
    const enabled = process.env.NEWS_ENABLED === "true";
    if (!enabled) {
      return {
        enabled: false,
        available: false,
        items: [],
        reason: "NEWS_ENABLED is false",
      };
    }

    return {
      enabled: true,
      available: false,
      items: [],
      reason: "No news provider configured",
    };
  }
}

const provider: NewsProvider =
  process.env.NEWS_ENABLED === "true" ? new FinnhubNewsProvider() : new DisabledNewsProvider();

export async function getNewsForTicker(ticker: string) {
  return provider.getCompanyNews(ticker);
}
