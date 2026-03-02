import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type QuoteResponse = {
  c?: number;
  pc?: number;
};

function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

async function fetchPrice(ticker: string, key: string) {
  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${key}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return null;
  }
  const quote = (await res.json()) as QuoteResponse;
  const current = Number(quote.c ?? 0);
  const previous = Number(quote.pc ?? 0);
  if (!Number.isFinite(current) || current <= 0) {
    return null;
  }
  const dayChange = previous > 0 ? current - previous : 0;
  const dayChangePct = previous > 0 ? (dayChange / previous) * 100 : 0;
  return { price: current, dayChange, dayChangePct };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Missing FINNHUB_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const rawTickers = searchParams.get("tickers") ?? "";
  const tickers = Array.from(
    new Set(
      rawTickers
        .split(",")
        .map(normalizeTicker)
        .filter((value) => /^[A-Z.\-]{1,10}$/.test(value)),
    ),
  ).slice(0, 50);

  if (tickers.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const price = await fetchPrice(ticker, key);
      return [ticker, price] as const;
    }),
  );

  const prices = Object.fromEntries(entries);
  return NextResponse.json({ prices });
}
