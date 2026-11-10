# TODO

## Pending from user

- [ ] Enable GitHub Pages: repo Settings → Pages → Source: **GitHub Actions** (one-time).
- [x] Sample squad export (attributes) — saved in `src/import/fixtures/`.
- [ ] More sample exports: squad **stats** view (apps, goals, ratings), **contract/finance** view (value, wage, expiry), **GK attributes**, **staff** view, **scouting/shortlist** view.
- [ ] Run `supabase/migrations/0002_settings_and_images.sql` in Supabase SQL Editor.
- [ ] Status code meanings (Settings → Statuses).
- [ ] Own icons / logo — replace files in `public/icons/` (see README there).
- [x] Supabase project + schema.
- [ ] Supabase auth: URL configuration + add `{{ .Token }}` to Magic Link email template; disable sign-ups after first login.

## Next up

- [x] Login (magic link / code), careers, squad import, squad + player pages.
- [ ] Local cache for offline read.
- [x] In-app settings: statuses, attributes, layout. Crest and kit uploads.
- [ ] Show imported stats / contract columns (currently stored, not displayed).
- [ ] Manual column mapping override in importer (saved per view).
- [ ] Staff and scouting backed by Supabase + import.
- [ ] Squad table: sorting, filtering, column picker (TanStack Table + Virtual).
- [ ] Scouting board drag & drop (dnd-kit).
- [ ] Dashboard charts, achievements, season timeline.
- [ ] Daily Supabase keep-alive GitHub Action.

## Roadmap (agreed)

- [x] Scouting network v1: scout limit per season, regions → countries (editable), head of region (bordering regions only) + scouts with focus countries, staff entry with FM rating words and scouting knowledge.
- [ ] Run `supabase/migrations/0003_scouting_network.sql`.
- [x] FM27 staff rating scale (Unsuited 0–3 … Elite 20) and knowledge levels (Minimal … Complete).
- [x] Staff: Reputation field.
- [ ] Run `supabase/migrations/0004_staff_reputation.sql`.
- [x] Development page: rank squad by attribute gains over the last N imports, trend per player.
- [x] Role-fit score (0–100 per FM27 role) with editable roles, tiers and factors.
- [x] Head-to-head comparison: up to 5 players, radar charts + attribute table.
- [ ] Scouting by role: rank scouted players for a role, filters (age, value, personality, attribute minimums), strengths/weaknesses, impact on best XI.
- [ ] Load FM27 save file in the browser (all players in the save) via fmsave (MIT) in Pyodide. Hidden values: Settings switch (as in game vs everything). Needs: test save from user (63 MB, send split in 25 MB parts), storage plan for the world database.
