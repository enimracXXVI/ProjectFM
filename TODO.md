# TODO

## Pending from user

- [ ] Enable GitHub Pages: repo Settings → Pages → Source: **GitHub Actions** (one-time).
- [x] Sample squad export (attributes) — saved in `src/import/fixtures/`.
- [ ] More sample exports: squad **stats** view (apps, goals, ratings), **contract/finance** view (value, wage, expiry), **GK attributes**, **staff** view, **scouting/shortlist** view.
- [ ] Own icons / logo — replace files in `public/icons/` (see README there).
- [x] Supabase project + schema.
- [ ] Supabase auth: URL configuration + add `{{ .Token }}` to Magic Link email template; disable sign-ups after first login.

## Next up

- [x] Login (magic link / code), careers, squad import, squad + player pages.
- [ ] Local cache for offline read.
- [ ] Manual column mapping override in importer (saved per view).
- [ ] Staff and scouting backed by Supabase + import.
- [ ] Squad table: sorting, filtering, column picker (TanStack Table + Virtual).
- [ ] Scouting board drag & drop (dnd-kit).
- [ ] Dashboard charts, achievements, season timeline.
- [ ] Daily Supabase keep-alive GitHub Action.
