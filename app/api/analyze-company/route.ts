import { analyzeCompanyData } from "@/lib/ai/openai";
import { getNewsForTicker } from "@/lib/news/provider";
import { createClient } from "@/lib/supabase/server";
import { analyzeCompanySchema } from "@/lib/validation";
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
    const parsed = analyzeCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { valuationId, forceRefresh } = parsed.data;

    const { data: valuation, error } = await supabase
      .from("valuations")
      .select("id,ticker,report_json,ai_analysis,ai_generated_at")
      .eq("id", valuationId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error || !valuation) {
      return NextResponse.json({ error: "Valuation not found" }, { status: 404 });
    }

    if (valuation.ai_analysis && !forceRefresh) {
      return NextResponse.json({
        analysis: valuation.ai_analysis,
        cached: true,
        generatedAt: valuation.ai_generated_at,
      });
    }

    const report = valuation.report_json as {
      ticker: string;
      companyName: string;
      cik: string;
    };

    if (!report?.ticker || !report?.companyName || !report?.cik) {
      return NextResponse.json(
        { error: "Valuation report is missing required fields for AI analysis" },
        { status: 422 },
      );
    }

    const news = await getNewsForTicker(report.ticker);

    const analysis = await analyzeCompanyData({
      ticker: report.ticker,
      companyName: report.companyName,
      cik: report.cik,
      reportData: valuation.report_json,
      newsEnabled: news.enabled && news.available,
    });

    await supabase
      .from("valuations")
      .update({
        ai_analysis: analysis,
        ai_generated_at: new Date().toISOString(),
      })
      .eq("id", valuation.id)
      .eq("user_id", auth.user.id);

    return NextResponse.json({
      analysis,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/analyze-company error", error);
    const message = error instanceof Error ? error.message : "AI analysis failed";
    if (message.includes("Missing OPENAI_API_KEY")) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    }
    if (message.includes("OpenAI API 401")) {
      return NextResponse.json({ error: "OpenAI authentication failed: invalid API key" }, { status: 502 });
    }
    if (message.includes("OpenAI API 429")) {
      return NextResponse.json({ error: "OpenAI rate limit exceeded. Retry shortly." }, { status: 429 });
    }
    return NextResponse.json({ error: message || "AI analysis failed" }, { status: 500 });
  }
}
