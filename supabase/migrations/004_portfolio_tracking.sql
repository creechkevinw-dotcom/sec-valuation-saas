create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolios_user_created_idx
  on portfolios(user_id, created_at desc);

create table if not exists portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  ticker text not null,
  quantity numeric not null check (quantity > 0),
  cost_basis numeric not null check (cost_basis >= 0),
  opened_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, ticker)
);

create index if not exists portfolio_positions_user_created_idx
  on portfolio_positions(user_id, created_at desc);

create index if not exists portfolio_positions_portfolio_idx
  on portfolio_positions(portfolio_id, created_at desc);

alter table portfolios enable row level security;
alter table portfolio_positions enable row level security;

create policy "portfolios self access" on portfolios
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "portfolio_positions self access" on portfolio_positions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
