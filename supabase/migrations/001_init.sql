create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz default now()
);

create index if not exists profiles_plan_idx on profiles(plan);

create table if not exists valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ticker text not null,
  health_score integer not null,
  fair_value_base numeric not null,
  fair_value_bull numeric not null,
  fair_value_bear numeric not null,
  wacc numeric not null,
  terminal_growth numeric not null,
  report_json jsonb,
  sensitivity jsonb,
  pdf_path text,
  created_at timestamptz default now()
);

create index if not exists valuations_user_id_idx on valuations(user_id);
create index if not exists valuations_ticker_idx on valuations(ticker);

create table if not exists financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  valuation_id uuid not null references valuations(id) on delete cascade,
  year integer not null,
  revenue numeric,
  ebit numeric,
  net_income numeric,
  fcf numeric,
  total_debt numeric,
  cash numeric
);

create index if not exists financial_snapshots_val_idx on financial_snapshots(valuation_id);

create table if not exists usage_tracking (
  user_id uuid references profiles(id) on delete cascade,
  month text,
  valuation_count integer default 0,
  primary key (user_id, month)
);

create table if not exists error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  route text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table valuations enable row level security;
alter table financial_snapshots enable row level security;
alter table usage_tracking enable row level security;
alter table error_events enable row level security;

create policy "profiles self access" on profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "valuations self access" on valuations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "snapshots through valuation" on financial_snapshots
for all
using (
  exists (
    select 1 from valuations v where v.id = financial_snapshots.valuation_id and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from valuations v where v.id = financial_snapshots.valuation_id and v.user_id = auth.uid()
  )
);

create policy "usage self access" on usage_tracking
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "errors self insert" on error_events
for insert with check (auth.uid() = user_id or user_id is null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
