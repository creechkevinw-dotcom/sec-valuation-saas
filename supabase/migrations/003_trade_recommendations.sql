create table if not exists recommendation_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  consent_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, consent_version)
);

create index if not exists recommendation_consents_user_created_idx
  on recommendation_consents(user_id, created_at desc);

create table if not exists live_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ticker text not null,
  provider_source text not null,
  session_status text not null,
  snapshot_json jsonb not null,
  data_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists live_market_snapshots_user_ticker_created_idx
  on live_market_snapshots(user_id, ticker, created_at desc);

create table if not exists trade_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ticker text not null,
  status text not null check (status in ('success', 'refused')),
  reason_code text,
  provider_source text,
  confidence_score numeric,
  data_timestamp timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists trade_recommendations_user_ticker_created_idx
  on trade_recommendations(user_id, ticker, created_at desc);

alter table recommendation_consents enable row level security;
alter table live_market_snapshots enable row level security;
alter table trade_recommendations enable row level security;

create policy "recommendation_consents self access" on recommendation_consents
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "live_market_snapshots self access" on live_market_snapshots
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trade_recommendations self access" on trade_recommendations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
