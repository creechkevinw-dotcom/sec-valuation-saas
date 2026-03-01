import { cacheGet, cacheSet } from "@/lib/trade/cache";
import type { EarningsSnapshot } from "@/lib/trade/types";

const CACHE_TTL_MS = 24 * 60 * 60_000;

type EarningsItem = {
  date: string;
  symbol: string;
};

type EarningsResponse = {
  earningsCalendar?: EarningsItem[];
};

function requireMarketApiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Missing FINNHUB_API_KEY");
  return key;
}

function daysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.floor(diff / (24 * 60 * 60_000));
}

export async function getEarningsSnapshot(ticker: string): Promise<EarningsSnapshot> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `earnings:${symbol}`;
  const cached = cacheGet<EarningsSnapshot>(cacheKey);
  if (cached) return cached;

  const key = requireMarketApiKey();
  const from = new Date().toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 180);
  const to = toDate.toISOString().slice(0, 10);

  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${from}&to=${to}&token=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Earnings provider error ${res.status}`);
  }
  const json = (await res.json()) as EarningsResponse;
  const next = (json.earningsCalendar ?? [])
    .filter((e) => e.symbol === symbol && !!e.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const days = next?.date ? daysUntil(next.date) : null;
  const snapshot: EarningsSnapshot = {
    nextEarningsDate: next?.date ?? null,
    daysUntilEarnings: days,
    earningsRisk: days !== null ? days < 7 : false,
    sameWeek: days !== null ? days <= 7 : false,
    source: "finnhub",
  };

  cacheSet(cacheKey, snapshot, CACHE_TTL_MS);
  return snapshot;
}
