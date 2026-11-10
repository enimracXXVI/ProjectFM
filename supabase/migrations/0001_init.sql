-- ProjectFM initial schema
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Every row belongs to the signed-in user; Row Level Security enforces that.

-- ---------------------------------------------------------------------------
-- Careers (one per FM save)
-- ---------------------------------------------------------------------------
create table public.careers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  club           text not null,
  nation         text,
  start_season   text,
  current_season text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Players: latest known state of each player in a career.
-- fm_uid = FM "Unique ID", used to match rows on re-import.
-- attributes: { "Crossing": 12, "Pace": "11-14", ... } (ranges when partly scouted)
-- ---------------------------------------------------------------------------
create table public.players (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id     uuid not null references public.careers (id) on delete cascade,
  fm_uid        bigint,
  name          text not null,
  positions     text,
  squad_number  int,
  age           int,
  nation        text,
  second_nation text,
  height_cm     int,
  left_foot     text,
  right_foot    text,
  personality   text,
  attributes    jsonb not null default '{}'::jsonb,
  extra         jsonb not null default '{}'::jsonb,
  in_squad      boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (career_id, fm_uid)
);
create index players_career_idx on public.players (career_id);

-- ---------------------------------------------------------------------------
-- Player snapshots: one per import, for development history over time.
-- ---------------------------------------------------------------------------
create table public.player_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  career_id   uuid not null references public.careers (id) on delete cascade,
  import_id   uuid,
  season      text,
  game_date   date,
  age         int,
  attributes  jsonb not null default '{}'::jsonb,
  stats       jsonb not null default '{}'::jsonb,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index player_snapshots_player_idx on public.player_snapshots (player_id, created_at);

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id   uuid not null references public.careers (id) on delete cascade,
  fm_uid      bigint,
  name        text not null,
  role        text,
  age         int,
  nation      text,
  attributes  jsonb not null default '{}'::jsonb,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (career_id, fm_uid)
);
create index staff_career_idx on public.staff (career_id);

-- ---------------------------------------------------------------------------
-- Scouting targets (board columns = status)
-- ---------------------------------------------------------------------------
create table public.scout_targets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id   uuid not null references public.careers (id) on delete cascade,
  fm_uid      bigint,
  name        text not null,
  club        text,
  positions   text,
  age         int,
  status      text not null default 'watching'
              check (status in ('watching', 'bid', 'signed', 'rejected')),
  sort_order  double precision not null default 0,
  rating      numeric(2, 1),
  value       bigint,
  notes       text,
  attributes  jsonb not null default '{}'::jsonb,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index scout_targets_career_idx on public.scout_targets (career_id);

-- ---------------------------------------------------------------------------
-- Imports log + saved column mappings per view type
-- ---------------------------------------------------------------------------
create table public.imports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id   uuid not null references public.careers (id) on delete cascade,
  view_type   text not null,
  file_name   text,
  season      text,
  row_count   int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.import_mappings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  view_type   text not null,
  mapping     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, view_type)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger careers_touch       before update on public.careers         for each row execute function public.touch_updated_at();
create trigger players_touch       before update on public.players         for each row execute function public.touch_updated_at();
create trigger staff_touch         before update on public.staff           for each row execute function public.touch_updated_at();
create trigger scout_targets_touch before update on public.scout_targets   for each row execute function public.touch_updated_at();
create trigger mappings_touch      before update on public.import_mappings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user sees and edits only their own rows.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'careers', 'players', 'player_snapshots', 'staff',
    'scout_targets', 'imports', 'import_mappings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
