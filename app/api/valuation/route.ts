import { checkRateLimit } from "@/lib/rate-limit";
import { buildValuationReport } from "@/lib/report";
import { createClient } from "@/lib/supabase/server";
import { incrementUsage, enforceUsageLimit } from "@/lib/usage";
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

    if (!checkRateLimit(auth.user.id, 5)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = tickerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticker", details: parsed.error.flatten() }, { status: 400 });
    }

    const usage = await enforceUsageLimit(auth.user.id);
    if (!usage.allowed) {
      return NextResponse.json({ error: "Usage limit exceeded" }, { status: 403 });
    }

    const report = await buildValuationReport(parsed.data.ticker);

    const { data: valuation, error } = await supabase
      .from("valuations")
      .insert({
        user_id: auth.user.id,
        ticker: report.ticker,
        health_score: report.healthScore,
        fair_value_base: report.dcf.base.fairValuePerShare,
        fair_value_bull: report.dcf.bull.fairValuePerShare,
        fair_value_bear: report.dcf.bear.fairValuePerShare,
        wacc: report.dcf.base.wacc,
        terminal_growth: report.dcf.base.terminalGrowth,
        report_json: report,
        sensitivity: report.dcf.sensitivity,
      })
      .select("id")
      .single();

    if (error || !valuation) {
      return NextResponse.json({ error: "Failed to save valuation" }, { status: 500 });
    }

    const snapshotRows = report.history.map((row) => ({
      valuation_id: valuation.id,
      year: row.year,
      revenue: row.revenue,
      ebit: row.ebit,
      net_income: row.netIncome,
      fcf: row.fcf,
      total_debt: row.totalDebt,
      cash: row.cash,
    }));

    await supabase.from("financial_snapshots").insert(snapshotRows);
    await incrementUsage(auth.user.id);

    return NextResponse.json({
      valuationId: valuation.id,
      healthScore: report.healthScore,
      fairValueBase: report.dcf.base.fairValuePerShare,
      fairValueBull: report.dcf.bull.fairValuePerShare,
      fairValueBear: report.dcf.bear.fairValuePerShare,
    });
  } catch (error) {
    console.error("POST /api/valuation error", error);
    return NextResponse.json({ error: "SEC API failure" }, { status: 500 });
  }
}
