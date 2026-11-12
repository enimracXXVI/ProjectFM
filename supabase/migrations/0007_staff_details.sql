-- ProjectFM: every member of staff from the FM save (not only scouts)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- team:     'first', 'u21' (U20) or 'u18', as the save says
-- job_code: FM's job code from the save (the app turns it into the job title)
-- extra:    { "Last name": "...", "Common name": "...", ... }
alter table public.staff
  add column if not exists team     text,
  add column if not exists job_code int,
  add column if not exists extra    jsonb not null default '{}'::jsonb;
