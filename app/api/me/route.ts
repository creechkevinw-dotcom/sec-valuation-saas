import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,plan,created_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data: usage } = await supabase
    .from("usage_tracking")
    .select("valuation_count")
    .eq("user_id", auth.user.id)
    .eq("month", month)
    .maybeSingle();

  return NextResponse.json({
    profile,
    usage: {
      month,
      valuationCount: usage?.valuation_count ?? 0,
      limit: profile?.plan === "pro" ? null : 3,
    },
  });
}
