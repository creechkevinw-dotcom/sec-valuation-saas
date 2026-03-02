import { cacheGet, cacheSet } from "@/lib/trade/cache";
import type { TechnicalSnapshot } from "@/lib/trade/types";

const CACHE_TTL_MS = 5 * 60_000;
const MIN_REQUIRED_POINTS = 120;

type CandleResponse = {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
};

function requireMarketApiKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error("Missing FINNHUB_API_KEY");
  }
  return key;
}

async function fetchCandles(ticker: string): Promise<CandleResponse> {
  const key = requireMarketApiKey();
  const to = Math.floor(Date.now() / 1000);
  const from = to - 550 * 24 * 60 * 60;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${key}`,
        { cache: "no-store" },
      );

      if (res.status === 429) {
        throw new Error("TECHNICAL_RATE_LIMIT");
      }
      if (!res.ok) {
        throw new Error(`TECHNICAL_PROVIDER_ERROR_${res.status}`);
      }

      const json = (await res.json()) as CandleResponse;
      if (json.s === "ok") {
        return json;
      }
      if (json.s === "no_data") {
        throw new Error("TECHNICAL_NO_DATA");
      }
      throw new Error("TECHNICAL_DATA_UNAVAILABLE");
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("TECHNICAL_PROVIDER_ERROR");
}

function sma(values: number[], period: number) {
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  let current = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i += 1) {
    current = values[i] * k + current * (1 - k);
  }
  return current;
}

function rsi(values: number[], period = 14) {
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period || 1e-9;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function stddev(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function atr(high: number[], low: number[], close: number[], period = 14) {
  const trs: number[] = [];
  for (let i = 1; i < close.length; i += 1) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1]),
    );
    trs.push(tr);
  }
  return sma(trs, period);
}

export async function getTechnicalSnapshot(ticker: string): Promise<TechnicalSnapshot> {
  const symbol = ticker.trim().toUpperCase();
  const cacheKey = `technical:${symbol}`;
  const cached = cacheGet<TechnicalSnapshot>(cacheKey);
  if (cached) return cached;

  const candles = await fetchCandles(symbol);
  const close = candles.c;
  const high = candles.h;
  const low = candles.l;
  const volume = candles.v;
  const ts = candles.t;

  if (close.length < MIN_REQUIRED_POINTS) {
    throw new Error(`TECHNICAL_INSUFFICIENT_HISTORY_${close.length}`);
  }

  const p20 = Math.min(20, close.length);
  const p50 = Math.min(50, close.length);
  const p200 = Math.min(200, close.length);
  const e12 = Math.min(12, close.length);
  const e26 = Math.min(26, close.length);
  const r14 = Math.min(14, close.length - 1);
  const a14 = Math.min(14, close.length - 1);

  const sma20 = sma(close, p20);
  const sma50 = sma(close, p50);
  const sma200 = sma(close, p200);
  const ema12 = ema(close, e12);
  const ema26 = ema(close, e26);
  const macd = ema12 - ema26;
  const macdSignal = macd * 0.8;
  const rsi14 = rsi(close, r14);
  const atr14 = atr(high, low, close, a14);
  const bbMid = sma20;
  const bbDev = stddev(close.slice(-p20));
  const bbUpper = bbMid + 2 * bbDev;
  const bbLower = bbMid - 2 * bbDev;
  const recentVol = sma(volume, p20);
  const priorSlice = volume.slice(0, -p20);
  const priorWindow = Math.min(p20, priorSlice.length);
  const priorVol = priorWindow >= 5 ? sma(priorSlice, priorWindow) : recentVol;
  const volumeTrend = priorVol > 0 ? recentVol / priorVol : 1;

  const momentumScore = Math.max(
    0,
    Math.min(
      100,
      50 +
        (close[close.length - 1] > sma50 ? 10 : -10) +
        (rsi14 > 55 ? 10 : rsi14 < 45 ? -10 : 0) +
        (macd > 0 ? 10 : -10),
    ),
  );

  const snapshot: TechnicalSnapshot = {
    points: close.length,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    rsi14,
    macd,
    macdSignal,
    atr14,
    bbUpper,
    bbLower,
    volumeTrend,
    momentumScore,
    lastClose: close[close.length - 1],
    lastTimestamp: new Date(ts[ts.length - 1] * 1000).toISOString(),
  };

  cacheSet(cacheKey, snapshot, CACHE_TTL_MS);
  return snapshot;
}
