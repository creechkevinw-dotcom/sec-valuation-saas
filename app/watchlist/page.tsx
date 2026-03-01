import { createClient } from "@/lib/supabase/server";
import { AppNavTabs } from "@/components/app-nav-tabs";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
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
      .select("id,ticker,health_score,fair_value_base,created_at")
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
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2">Ticker</th>
                <th className="pb-2">Added</th>
                <th className="pb-2">Latest Health</th>
                <th className="pb-2">Latest Base Fair Value</th>
                <th className="pb-2">Latest Valuation</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const latest = recentValuations?.find((v) => v.ticker === item.ticker);
                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-900">{item.ticker}</td>
                    <td className="py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="py-2">{latest?.health_score ?? "-"}</td>
                    <td className="py-2">
                      {latest ? `$${Number(latest.fair_value_base).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2">
                      {latest ? (
                        <Link href={`/valuation/${latest.id}`} className="text-sky-700 underline">
                          Open report
                        </Link>
                      ) : (
                        <span className="text-slate-500">No valuation yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
