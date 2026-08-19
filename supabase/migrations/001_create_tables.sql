-- Migration: Create user_favorites and card_favorite_counts tables
-- Created for: k2tse Style Explorer

-- Create user_favorites table
create table public.user_favorites (
  user_id uuid not null,
  card_id text not null,
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- Create card_favorite_counts table
create table public.card_favorite_counts (
  card_id text primary key,
  total_favs bigint not null default 0
);

-- Enable Row Level Security
alter table public.user_favorites enable row level security;
alter table public.card_favorite_counts enable row level security;

-- ============================================================
-- Policies
-- ============================================================

-- Anyone can read the aggregate counts (for community likes)
create policy "counts are public"
  on public.card_favorite_counts for select
  using (true);

-- Users can read their own favorites
create policy "users read own favorites"
  on public.user_favorites for select
  using (auth.uid() = user_id);

-- Users can insert their own favorites
create policy "users insert own favorites"
  on public.user_favorites for insert
  with check (auth.uid() = user_id);

-- Users can update their own favorites
create policy "users update own favorites"
  on public.user_favorites for update
  using (auth.uid() = user_id);

-- Users can delete their own favorites
create policy "users delete own favorites"
  on public.user_favorites for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Functions for auto-updating favorite counts
-- ============================================================

-- Increment count when a favorite is added
create or replace function public.increment_fav_count()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.card_favorite_counts (card_id, total_favs)
  values (new.card_id, 1)
  on conflict (card_id) do update
    set total_favs = public.card_favorite_counts.total_favs + 1;
  return new;
end;
$$;

-- Decrement count when a favorite is removed
create or replace function public.decrement_fav_count()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.card_favorite_counts
  set total_favs = greatest(0, total_favs - 1)
  where card_id = old.card_id;
  return old;
end;
$$;

-- ============================================================
-- Triggers
-- ============================================================

create trigger trg_fav_insert
  after insert on public.user_favorites
  for each row execute function public.increment_fav_count();

create trigger trg_fav_delete
  after delete on public.user_favorites
  for each row execute function public.decrement_fav_count();