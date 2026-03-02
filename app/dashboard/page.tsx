import { createClient } from "@/lib/supabase/server";
import { TickerInputForm } from "@/components/ticker-input-form";
import { EmptyState } from "@/components/empty-state";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { AppNavTabs } from "@/components/app-nav-tabs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [{ data: profile }, { data: valuations }, { data: usage }] = await Promise.all([
    supabase.from("profiles").select("plan,email").eq("id", user.id).maybeSingle(),
    supabase
      .from("valuations")
      .select("id,ticker,health_score,fair_value_base,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("usage_tracking")
      .select("valuation_count")
      .eq("user_id", user.id)
      .eq("month", month)
      .maybeSingle(),
  ]);

  const used = usage?.valuation_count ?? 0;
  const remaining = profile?.plan === "pro" ? 999999 : Math.max(0, 3 - used);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-6">
        <AppNavTabs />
      </div>

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Signed in as {profile?.email ?? user.email}</p>
          <h1 className="text-3xl font-semibold text-slate-900">Valuation Dashboard</h1>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
          Plan: <span className="font-semibold uppercase">{profile?.plan ?? "free"}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <TickerInputForm />
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Monthly Usage</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {profile?.plan === "pro" ? `${used} used` : `${used} / 3`}
            </p>
          </div>
          <WatchlistPanel />
          <UpgradeBanner remaining={remaining} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Saved Valuations</h2>
          {!valuations?.length ? (
            <EmptyState
              title="No valuations yet"
              body="Run your first valuation using a US public ticker symbol."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="pb-2">Ticker</th>
                    <th className="pb-2">Health</th>
                    <th className="pb-2">Mid Fair Value</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">
                        <Link href={`/valuation/${item.id}`} className="hover:underline">
                          {item.ticker}
                        </Link>
                      </td>
                      <td className="py-2">{item.health_score}</td>
                      <td className="py-2">${Number(item.fair_value_base).toFixed(2)}</td>
                      <td className="py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
