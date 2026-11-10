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

- [ ] Scouting network: scout limit, regions → countries, head of region + scouts (questions pending).
- [ ] Development page: rank squad by attribute gains over the last N imports, trend per player.
- [ ] Role-fit score (0–100 per FM role) with editable attribute weights; own implementation (FM-Player-Analyzer is GPL-3, ideas only).
- [ ] Head-to-head comparison: up to 5 players, radar charts + attribute table.
- [ ] Scouting by role: rank scouted players for a role, filters (age, value, personality, attribute minimums), strengths/weaknesses, impact on best XI.
- [ ] Load FM27 save file in the browser (all players in the save) via fmsave (MIT) in Pyodide. Needs: test save from user, decision on hidden values (CA/PA) and scouting fog of war, storage plan for the world database.
