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

  const [market, technical, earnings, options] = await Promise.all([
    runStage(() => getMarketSnapshot(ticker), (v) => ({ ok: true, source: v.source, timestamp: v.lastTradeTimestamp })),
    runStage(() => getTechnicalSnapshot(ticker), (v) => ({ ok: true, source: v.source, points: v.points, timestamp: v.lastTimestamp })),
    runStage(() => getEarningsSnapshot(ticker), (v) => ({ ok: true, source: v.source, timestamp: v.nextEarningsDate ?? undefined })),
    runStage(() => getOptionsSnapshot(ticker), (v) => ({ ok: true, source: v.source, points: v.contracts.length })),
  ]);

  return NextResponse.json({
    ticker,
    diagnosedAt: new Date().toISOString(),
    stages: {
      market,
      technical,
      earnings,
      options,
    },
  });
}
