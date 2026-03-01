import { createClient } from "@/lib/supabase/server";
import { watchlistMutationSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .select("id,ticker,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load watchlist" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = watchlistMutationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticker", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      user_id: auth.user.id,
      ticker: parsed.data.ticker,
    })
    .select("id,ticker,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add watchlist item" }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = watchlistMutationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticker", details: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("ticker", parsed.data.ticker);

  if (error) {
    return NextResponse.json({ error: "Failed to remove watchlist item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
