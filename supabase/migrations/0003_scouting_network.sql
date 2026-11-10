-- ProjectFM: scouts and scouting network
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- Staff: scout details entered in the app
-- attributes: { "Judging Player Ability": "Outstanding", ... } (FM's rating words)
-- knowledge:  [ { "nation": "Italy", "level": "Complete" }, ... ]
alter table public.staff
  add column personality text,
  add column knowledge   jsonb not null default '[]'::jsonb,
  add column notes       text;

-- Scouting network per career (one JSON document):
-- { "limits": { "2026/27": 12 },
--   "heads":  { "<region id>": "<staff id>" },
--   "scouts": { "<staff id>": { "region": "<region id>", "countries": ["Italy"] } } }
alter table public.careers
  add column scouting jsonb not null default '{}'::jsonb;
