-- ProjectFM: tactics (with preferred XI) and the match log
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- Tactics: imported from the save (save_index set) or created in the app.
-- slots:        [ { "position": "DC", "role": "<role id>", "player": "<player id>" }, ... ] (11)
-- instructions: free-form until decoded from the save
create table public.tactics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id     uuid not null references public.careers (id) on delete cascade,
  name          text not null,
  style         text,
  mentality     text,
  slots         jsonb not null default '[]'::jsonb,
  instructions  jsonb not null default '{}'::jsonb,
  notes         text,
  save_index    int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (career_id, save_index)
);

-- Match log: what the user adds to each match (the result itself comes from the save).
-- match_key: "<date>_<home club>_<away club>" as the app builds it
create table public.match_log (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  career_id          uuid not null references public.careers (id) on delete cascade,
  match_key          text not null,
  competition_db_id  bigint,
  season             int,
  tactic_id          uuid references public.tactics (id) on delete set null,
  opponent_formation text,
  opponent_style     text,
  opponent_mentality text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (career_id, match_key)
);

create trigger tactics_touch   before update on public.tactics   for each row execute function public.touch_updated_at();
create trigger match_log_touch before update on public.match_log for each row execute function public.touch_updated_at();

alter table public.tactics   enable row level security;
alter table public.match_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tactics', 'match_log'] loop
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;
