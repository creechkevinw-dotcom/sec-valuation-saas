import { createClient } from "@/lib/supabase/server";
import { recommendationConsentSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_CONSENT_VERSION = "v1";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recommendation_consents")
    .select("consent_version,accepted_at")
    .eq("user_id", auth.user.id)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load consent" }, { status: 500 });
  }

  return NextResponse.json({
    requiredVersion: DEFAULT_CONSENT_VERSION,
    accepted: Boolean(data && data.consent_version === DEFAULT_CONSENT_VERSION),
    acceptedAt: data?.accepted_at ?? null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = recommendationConsentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase.from("recommendation_consents").upsert(
    {
      user_id: auth.user.id,
      consent_version: parsed.data.consentVersion,
      accepted_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,consent_version",
      ignoreDuplicates: false,
    },
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save consent" }, { status: 500 });
  }

  return NextResponse.json({ success: true, consentVersion: parsed.data.consentVersion });
}
