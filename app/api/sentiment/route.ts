import { getSentimentForTicker } from "@/lib/sentiment/provider";
import { createClient } from "@/lib/supabase/server";
import { tickerSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    const sentiment = await getSentimentForTicker(parsed.data.ticker);
    return NextResponse.json({ sentiment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sentiment fetch failed" },
      { status: 500 },
    );
  }
}
