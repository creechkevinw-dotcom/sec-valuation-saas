import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { ScoreCard } from "@/components/score-card";
import { ValuationSummary } from "@/components/valuation-summary";
import { SensitivityTable } from "@/components/sensitivity-table";
import { FinancialHistoryChart } from "@/components/financial-history-chart";
import { FilingsPanel } from "@/components/filings-panel";
import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { AppNavTabs } from "@/components/app-nav-tabs";
import { WatchlistSaveButton } from "@/components/watchlist-save-button";
import { TradeRecommendationPanel } from "@/components/trade-recommendation-panel";

export const dynamic = "force-dynamic";

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <EmptyState title="Unauthorized" body="Please sign in." />;
  }

  const { data } = await supabase
    .from("valuations")
    .select("id,ticker,health_score,fair_value_base,fair_value_bull,fair_value_bear,report_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.report_json) {
    return <EmptyState title="Report not found" body="This valuation is unavailable." />;
  }

  if (!data.report_json || typeof data.report_json !== "object") {
    return <EmptyState title="Report unavailable" body="Stored valuation payload is invalid." />;
  }

  const report = data.report_json as {
    companyName?: string;
    ticker?: string;
    history?: Array<{ year: number; revenue: number; fcf: number }>;
    dcf?: { sensitivity?: Array<{ wacc: number; terminalGrowth: number; fairValuePerShare: number }> };
    filings?: {
      latest10K?: {
        form: string;
        filingDate: string;
        reportDate?: string | null;
        primaryDocDescription?: string;
        documentUrl: string;
      } | null;
      latest10Q?: {
        form: string;
        filingDate: string;
        reportDate?: string | null;
        primaryDocDescription?: string;
        documentUrl: string;
      } | null;
      recent10k10q?: Array<{
        form: string;
        filingDate: string;
        reportDate?: string | null;
        primaryDocDescription?: string;
        documentUrl: string;
      }>;
    };
    dataQuality?: { historyYears: number; has10K: boolean; has10Q: boolean; score: number };
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-10">
      <AppNavTabs />

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Valuation Report</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {report.companyName ?? data.ticker} ({report.ticker ?? data.ticker})
          </h1>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <WatchlistSaveButton ticker={report.ticker ?? data.ticker} />
          <a
            href={`/api/valuation/${id}/pdf`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Download PDF
          </a>
        </div>
      </header>

      <ValuationSummary
        base={Number(data.fair_value_base)}
        bull={Number(data.fair_value_bull)}
        bear={Number(data.fair_value_bear)}
      />
      <TradeRecommendationPanel ticker={report.ticker ?? data.ticker} />
      <ScoreCard score={data.health_score} />
      <AiAnalysisPanel valuationId={id} />
      <FilingsPanel
        latest10K={report.filings?.latest10K ?? null}
        latest10Q={report.filings?.latest10Q ?? null}
        recent={report.filings?.recent10k10q ?? []}
        quality={report.dataQuality ?? { historyYears: 0, has10K: false, has10Q: false, score: 0 }}
      />
      <FinancialHistoryChart rows={report.history ?? []} />
      <SensitivityTable rows={report.dcf?.sensitivity ?? []} />
    </main>
  );
}
