import { generateTradeRecommendation } from "@/lib/trade/recommendationEngine";
import { checkHourlyRateLimit } from "@/lib/trade/hourlyRateLimit";
import { createClient } from "@/lib/supabase/server";
import { tradeRecommendationSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONSENT_VERSION = "v1";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = tradeRecommendationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticker", details: parsed.error.flatten() }, { status: 400 });
    }

    const [{ data: profile }, { data: consent }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", auth.user.id).maybeSingle(),
      supabase
        .from("recommendation_consents")
        .select("consent_version,accepted_at")
        .eq("user_id", auth.user.id)
        .eq("consent_version", CONSENT_VERSION)
        .maybeSingle(),
    ]);

    if (!consent) {
      return NextResponse.json(
        {
          refused: true,
          reasonCode: "CONSENT_REQUIRED",
          reason: "Compliance acknowledgment is required before generating recommendations.",
          details: { consentVersion: CONSENT_VERSION },
        },
        { status: 403 },
      );
    }

    const plan = profile?.plan === "pro" ? "pro" : "free";
    const limit = plan === "pro" ? 20 : 3;
    const rateKey = `${auth.user.id}:trade-reco:${new Date().toISOString().slice(0, 13)}`;

    if (!checkHourlyRateLimit(rateKey, limit)) {
      const refusalPayload = {
        refused: true,
        reasonCode: "RATE_LIMIT",
        reason: `Hourly request limit reached for ${plan} plan`,
      } as const;

      await supabase.from("trade_recommendations").insert({
        user_id: auth.user.id,
        ticker: parsed.data.ticker,
        status: "refused",
        reason_code: refusalPayload.reasonCode,
        provider_source: "rate_limiter",
        payload: refusalPayload,
      });

      return NextResponse.json(refusalPayload, { status: 429 });
    }

    const result = await generateTradeRecommendation({
      ticker: parsed.data.ticker,
      userId: auth.user.id,
      supabase,
    });

    if (result.refused) {
      await supabase.from("trade_recommendations").insert({
        user_id: auth.user.id,
        ticker: parsed.data.ticker,
        status: "refused",
        reason_code: result.reasonCode,
        provider_source: "finnhub+supabase+openai",
        payload: result,
      });

      return NextResponse.json(result, { status: 200 });
    }

    await Promise.all([
      supabase.from("live_market_snapshots").insert({
        user_id: auth.user.id,
        ticker: result.ticker,
        provider_source: result.marketSnapshot.source,
        session_status: result.marketSnapshot.sessionStatus,
        snapshot_json: result.marketSnapshot,
        data_timestamp: result.dataTimestamp,
      }),
      supabase.from("trade_recommendations").insert({
        user_id: auth.user.id,
        ticker: result.ticker,
        status: "success",
        reason_code: null,
        provider_source: result.source,
        confidence_score: result.finalConfidence,
        data_timestamp: result.dataTimestamp,
        payload: result,
      }),
    ]);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/trade-recommendation error", error);
    return NextResponse.json(
      {
        refused: true,
        reasonCode: "PROVIDER_ERROR",
        reason: error instanceof Error ? error.message : "Trade recommendation failed",
      },
      { status: 500 },
    );
  }
}
