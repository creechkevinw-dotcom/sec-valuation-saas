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

const provider: NewsProvider = new DisabledNewsProvider();

export async function getNewsForTicker(ticker: string) {
  return provider.getCompanyNews(ticker);
}
