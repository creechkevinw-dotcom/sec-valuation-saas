import { createClient } from "@/lib/supabase/server";
import { AppNavTabs } from "@/components/app-nav-tabs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email,plan,created_at")
    .eq("id", user.id)
    .maybeSingle();

  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const newsEnabled = process.env.NEWS_ENABLED === "true";

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-6 py-10">
      <AppNavTabs />

      <header>
        <p className="text-sm text-slate-500">Account and system configuration visibility</p>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Account</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{profile?.email ?? user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Plan</dt>
            <dd className="font-medium uppercase text-slate-900">{profile?.plan ?? "free"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Member Since</dt>
            <dd className="font-medium text-slate-900">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">AI & Data Features</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-700">OpenAI analysis API</span>
            <span className={openAiConfigured ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {openAiConfigured ? "Configured" : "Not configured"}
            </span>
          </li>
          <li className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-700">News enrichment</span>
            <span className={newsEnabled ? "font-semibold text-emerald-700" : "font-semibold text-slate-600"}>
              {newsEnabled ? "Enabled" : "Disabled"}
            </span>
          </li>
        </ul>
      </section>
    </main>
  );
}
