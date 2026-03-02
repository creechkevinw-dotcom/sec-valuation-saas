import { cacheGet, cacheSet } from "@/lib/trade/cache";
import type { MarketSnapshot, SessionStatus } from "@/lib/trade/types";

const CACHE_TTL_MS = 30_000;
const SOURCE = "finnhub";

function requireMarketApiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error("Missing FINNHUB_API_KEY");
  }
  return key;
}

function getSessionStatus(now = new Date()): SessionStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
    weekday: "short",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday);

  if (!isWeekday) {
    return "CLOSED";
  }
  if (totalMinutes >= 4 * 60 && totalMinutes < 9 * 60 + 30) {
    return "PRE";
  }
  if (totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60) {
    return "OPEN";
  }
  if (totalMinutes >= 16 * 60 && totalMinutes < 20 * 60) {
    return "POST";
  }
  return "CLOSED";
}

type QuoteResponse = {
  c: number;
  pc?: number;
  t: number;
  v: number;
};

type BidAskResponse = {
  b: number;
  a: number;
  t: number;
};

type ProfileResponse = {
  ticker?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Market data provider error ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getMarketSnapshot(ticker: string): Promise<MarketSnapshot> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `market:${symbol}`;
  const cached = cacheGet<MarketSnapshot>(cacheKey);
  if (cached) {
    return cached;
  }

  const key = requireMarketApiKey();

  const [quote, profile] = await Promise.all([
    fetchJson<QuoteResponse>(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`),
    fetchJson<ProfileResponse>(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${key}`),
  ]);

  let bidAsk: BidAskResponse | null = null;
  try {
    bidAsk = await fetchJson<BidAskResponse>(
      `https://finnhub.io/api/v1/stock/bidask?symbol=${symbol}&token=${key}`,
    );
  } catch {
    bidAsk = null;
  }

  const rawPrice = Number(quote.c);
  const previousClose = Number(quote.pc ?? 0);
  const price = rawPrice > 0 ? rawPrice : previousClose;
  const dayChange = previousClose > 0 ? price - previousClose : 0;
  const dayChangePct = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;
  const bid = bidAsk?.b && Number(bidAsk.b) > 0 ? Number(bidAsk.b) : price;
  const ask = bidAsk?.a && Number(bidAsk.a) > 0 ? Number(bidAsk.a) : price;
  const midpoint = bid > 0 && ask > 0 ? (bid + ask) / 2 : price;
  const spreadPct = midpoint > 0 && ask >= bid ? ((ask - bid) / midpoint) * 100 : 100;
  const rawTimestampMs = Number(quote.t) * 1000;
  const tradeTimestampMs =
    Number.isFinite(rawTimestampMs) && rawTimestampMs > 0 ? rawTimestampMs : Date.now();
  const lastTradeTimestamp = new Date(tradeTimestampMs).toISOString();
  const sessionStatus = getSessionStatus();
  const staleThresholdMs =
    sessionStatus === "OPEN"
      ? 20 * 60_000
      : 24 * 60 * 60_000;
  const stale = Date.now() - tradeTimestampMs > staleThresholdMs;

  const halted = price <= 0;
  const active = Boolean(profile?.ticker);

  if (!active) {
    throw new Error("Ticker inactive or delisted");
  }
  if (halted) {
    throw new Error("Market halted or invalid quote");
  }
  if (spreadPct > 2) {
    throw new Error("Bid/ask spread too wide");
  }
  if (stale && sessionStatus === "OPEN") {
    throw new Error("Market data stale");
  }

  const snapshot: MarketSnapshot = {
    ticker: symbol,
    price,
    dayChange,
    dayChangePct,
    lastTradePrice: price,
    lastTradeTimestamp,
    bid,
    ask,
    midpoint,
    spreadPct,
    volume: Number(quote.v) || 0,
    sessionStatus,
    halted: false,
    active: true,
    stale,
    source: SOURCE,
  };

  cacheSet(cacheKey, snapshot, CACHE_TTL_MS);
  return snapshot;
}
