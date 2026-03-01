import { createClient } from "@/lib/supabase/server";

export function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function enforceUsageLimit(userId: string) {
  const supabase = await createClient();
  const month = monthKey();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const plan = profile?.plan ?? "free";
  if (plan === "pro") {
    return { allowed: true, plan, remaining: Number.POSITIVE_INFINITY };
  }

  const { data } = await supabase
    .from("usage_tracking")
    .select("valuation_count")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  const used = data?.valuation_count ?? 0;
  const limit = 3;

  return {
    allowed: used < limit,
    plan,
    remaining: Math.max(0, limit - used),
  };
}

export async function incrementUsage(userId: string) {
  const supabase = await createClient();
  const month = monthKey();

  const { data } = await supabase
    .from("usage_tracking")
    .select("valuation_count")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  if (!data) {
    await supabase.from("usage_tracking").insert({
      user_id: userId,
      month,
      valuation_count: 1,
    });
    return;
  }

  await supabase
    .from("usage_tracking")
    .update({ valuation_count: data.valuation_count + 1 })
    .eq("user_id", userId)
    .eq("month", month);
}
