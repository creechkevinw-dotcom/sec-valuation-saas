import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_10%_10%,#cffafe_0%,#f8fafc_45%,#ffffff_100%)] px-6">
      <section className="max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-slate-500">SEC Valuation SaaS</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-slate-900">
          Deterministic DCF Valuation from SEC Filings
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Enter one ticker. Get normalized 5-year financials, health score, transparent DCF, sensitivity, and investor-grade PDF report.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="/login" className="rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white">
            Sign In
          </a>
          <a href="/pricing" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
            Pricing
          </a>
        </div>
      </section>
    </main>
  );
}
