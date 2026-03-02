import { createClient } from "@/lib/supabase/server";
import {
  portfolioIdSchema,
  portfolioPositionCreateSchema,
  portfolioPositionDeleteSchema,
  portfolioPositionUpdateSchema,
} from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = portfolioIdSchema.safeParse({ portfolioId: searchParams.get("portfolioId") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid portfolio id", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("portfolio_positions")
    .select("id,portfolio_id,ticker,quantity,cost_basis,opened_at,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .eq("portfolio_id", parsed.data.portfolioId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load positions" }, { status: 500 });
  }

  return NextResponse.json({ positions: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioPositionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid position payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("portfolio_positions")
    .insert({
      portfolio_id: parsed.data.portfolioId,
      user_id: auth.user.id,
      ticker: parsed.data.ticker,
      quantity: parsed.data.quantity,
      cost_basis: parsed.data.costBasis,
      opened_at: parsed.data.openedAt ?? null,
    })
    .select("id,portfolio_id,ticker,quantity,cost_basis,opened_at,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add position" }, { status: 500 });
  }

  return NextResponse.json({ position: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioPositionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid position payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.quantity != null) update.quantity = parsed.data.quantity;
  if (parsed.data.costBasis != null) update.cost_basis = parsed.data.costBasis;
  if (parsed.data.openedAt !== undefined) update.opened_at = parsed.data.openedAt;

  const { data, error } = await supabase
    .from("portfolio_positions")
    .update(update)
    .eq("id", parsed.data.positionId)
    .eq("user_id", auth.user.id)
    .select("id,portfolio_id,ticker,quantity,cost_basis,opened_at,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update position" }, { status: 500 });
  }

  return NextResponse.json({ position: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioPositionDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid position payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", parsed.data.positionId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete position" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
