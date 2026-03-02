import { createClient } from "@/lib/supabase/server";
import { portfolioIdSchema, portfolioSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("portfolios")
    .select("id,name,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load portfolios" }, { status: 500 });
  }

  return NextResponse.json({ portfolios: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid portfolio payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name,
    })
    .select("id,name,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create portfolio" }, { status: 500 });
  }

  return NextResponse.json({ portfolio: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioIdSchema.extend({ name: portfolioSchema.shape.name }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid portfolio payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("portfolios")
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.portfolioId)
    .eq("user_id", auth.user.id)
    .select("id,name,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update portfolio" }, { status: 500 });
  }

  return NextResponse.json({ portfolio: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioIdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid portfolio payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", parsed.data.portfolioId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete portfolio" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
