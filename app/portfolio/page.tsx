import { AppNavTabs } from "@/components/app-nav-tabs";
import { PortfolioTracker } from "@/components/portfolio-tracker";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-10">
      <AppNavTabs />
      <PortfolioTracker />
    </main>
  );
}
