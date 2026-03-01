import { cacheGet, cacheSet } from "@/lib/trade/cache";
import type { OptionContract, OptionsSnapshot } from "@/lib/trade/types";

const CACHE_TTL_MS = 5 * 60_000;

type RawOption = {
  symbol: string;
  type: string;
  strike: number;
  expirationDate: string;
  bid: number;
  ask: number;
  openInterest: number;
  iv?: number;
};

type OptionsResponse = {
  data?: RawOption[];
};

function requireMarketApiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Missing FINNHUB_API_KEY");
  return key;
}

function normalize(raw: RawOption): OptionContract | null {
  if (!raw.symbol || !raw.expirationDate || !raw.strike) return null;
  const bid = Number(raw.bid) || 0;
  const ask = Number(raw.ask) || 0;
  if (bid <= 0 || ask <= 0 || ask < bid) return null;
  const midpoint = (bid + ask) / 2;
  const spreadPct = midpoint > 0 ? ((ask - bid) / midpoint) * 100 : 999;
  return {
    symbol: raw.symbol,
    type: raw.type?.toLowerCase().includes("put") ? "put" : "call",
    strike: Number(raw.strike),
    expiration: raw.expirationDate,
    bid,
    ask,
    spreadPct,
    openInterest: Number(raw.openInterest) || 0,
    iv: raw.iv != null ? Number(raw.iv) : null,
  };
}

export async function getOptionsSnapshot(ticker: string): Promise<OptionsSnapshot> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `options:${symbol}`;
  const cached = cacheGet<OptionsSnapshot>(cacheKey);
  if (cached) return cached;

  const key = requireMarketApiKey();
  const res = await fetch(`https://finnhub.io/api/v1/stock/option-chain?symbol=${symbol}&token=${key}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Options provider error ${res.status}`);
  }
  const json = (await res.json()) as OptionsResponse;
  const normalized = (json.data ?? []).map(normalize).filter((x): x is OptionContract => x !== null);

  const liquid = normalized.filter((c) => c.openInterest >= 100 && c.spreadPct <= 5);
  const totalOi = liquid.reduce((sum, c) => sum + c.openInterest, 0);
  const avgSpreadPct =
    liquid.length > 0 ? liquid.reduce((sum, c) => sum + c.spreadPct, 0) / liquid.length : null;
  const puts = liquid.filter((c) => c.type === "put").reduce((sum, c) => sum + c.openInterest, 0);
  const calls = liquid.filter((c) => c.type === "call").reduce((sum, c) => sum + c.openInterest, 0);
  const putCallRatio = calls > 0 ? puts / calls : null;

  const snapshot: OptionsSnapshot = {
    contracts: liquid.slice(0, 300),
    putCallRatio,
    ivRank: null,
    avgSpreadPct,
    totalOi,
    liquid: liquid.length > 0 && totalOi >= 1000 && (avgSpreadPct ?? 999) <= 5,
    source: "finnhub",
  };

  cacheSet(cacheKey, snapshot, CACHE_TTL_MS);
  return snapshot;
}
