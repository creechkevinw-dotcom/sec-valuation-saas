alter table if exists valuations
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_generated_at timestamptz;

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ticker text not null,
  created_at timestamptz default now(),
  unique (user_id, ticker)
);

create index if not exists watchlist_items_user_created_idx
  on watchlist_items(user_id, created_at desc);

alter table watchlist_items enable row level security;

create policy "watchlist self access" on watchlist_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
