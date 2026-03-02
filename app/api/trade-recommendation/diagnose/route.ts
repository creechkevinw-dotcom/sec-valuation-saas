import { getEarningsSnapshot } from "@/lib/trade/earnings";
import { getMarketSnapshot } from "@/lib/trade/marketData";
import { getOptionsSnapshot } from "@/lib/trade/optionsEngine";
import { getTechnicalSnapshot } from "@/lib/trade/technicalEngine";
import { createClient } from "@/lib/supabase/server";
import { tickerSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type StageResult =
  | { ok: true; source?: string; points?: number; timestamp?: string }
  | { ok: false; message: string };

async function runStage<T>(fn: () => Promise<T>, map: (value: T) => StageResult): Promise<StageResult> {
  try {
    const value = await fn();
    return map(value);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = tickerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticker", details: parsed.error.flatten() }, { status: 400 });
  }

  const ticker = parsed.data.ticker;
  const key = process.env.FINNHUB_API_KEY;

  const [market, technical, earnings, options, fundamentals] = await Promise.all([
    runStage(() => getMarketSnapshot(ticker), (v) => ({ ok: true, source: v.source, timestamp: v.lastTradeTimestamp })),
    runStage(() => getTechnicalSnapshot(ticker), (v) => ({ ok: true, source: v.source, points: v.points, timestamp: v.lastTimestamp })),
    runStage(() => getEarningsSnapshot(ticker), (v) => ({ ok: true, source: v.source, timestamp: v.nextEarningsDate ?? undefined })),
    runStage(() => getOptionsSnapshot(ticker), (v) => ({ ok: true, source: v.source, points: v.contracts.length })),
    runStage(
      async () => {
        if (!key) {
          throw new Error("Missing FINNHUB_API_KEY");
        }
        const [profileRes, candleRes, stooqRes] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${key}`, { cache: "no-store" }),
          fetch(
            `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${Math.floor(Date.now() / 1000) - 90 * 86400}&to=${Math.floor(Date.now() / 1000)}&token=${key}`,
            { cache: "no-store" },
          ),
          fetch(`https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`, { cache: "no-store" }),
        ]);
        return {
          profileStatus: profileRes.status,
          candleStatus: candleRes.status,
          stooqStatus: stooqRes.status,
        };
      },
      (v) => ({
        ok: true,
        source: `finnhub_profile:${v.profileStatus},finnhub_candle:${v.candleStatus},stooq:${v.stooqStatus}`,
      }),
    ),
  ]);

  return NextResponse.json({
    ticker,
    diagnosedAt: new Date().toISOString(),
    stages: {
      market,
      technical,
      earnings,
      options,
      fundamentals,
    },
  });
}
