import { createClient } from "@/lib/supabase/server";
import { AppNavTabs } from "@/components/app-nav-tabs";
import { EmptyState } from "@/components/empty-state";
import { WatchlistDetailTable } from "@/components/watchlist-detail-table";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: items }, { data: recentValuations }] = await Promise.all([
    supabase
      .from("watchlist_items")
      .select("id,ticker,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("valuations")
      .select("id,ticker,health_score,fair_value_base,created_at,ai_analysis")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-10">
      <AppNavTabs />

      <header>
        <p className="text-sm text-slate-500">Saved tickers you are monitoring</p>
        <h1 className="text-3xl font-semibold text-slate-900">Watchlist</h1>
      </header>

      {!items?.length ? (
        <EmptyState
          title="No watchlist items yet"
          body="Add tickers from your dashboard watchlist panel to track them here."
        />
      ) : (
        <WatchlistDetailTable items={items} recentValuations={recentValuations ?? []} />
      )}
    </main>
  );
}
