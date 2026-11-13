-- ProjectFM: notes on the Dashboard, one set per career, saved across devices.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id   uuid not null references public.careers (id) on delete cascade,
  category    text,
  body        text not null,
  pinned      boolean not null default false,
  done        boolean not null default false,
  -- Optional link to a player, a staff member or a match (match key as in the app's links)
  player_id   uuid references public.players (id) on delete set null,
  staff_id    uuid references public.staff (id) on delete set null,
  match_key   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index notes_career_idx on public.notes (career_id);

create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

alter table public.notes enable row level security;
create policy "own rows" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.notes to authenticated;
revoke all on public.notes from anon;
