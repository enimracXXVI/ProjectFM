# ProjectFM — Plan

Companion web app for Football Manager 2027 careers. Personal tracker; no game branding or assets.

## Product
- Multiple careers, each with seasons, squad, staff, stats, achievements.
- Import from FM HTML exports (Print Screen → Web Page) from day one: column auto-mapping, saved mappings per view, duplicate merge.
- Scouting board (drag & drop), tactics pitch, transfers/budget, season timeline, dashboard with charts.
- Search/filter, JSON backup, CSV / Google Sheets export.

## UX
- Mobile-first responsive; tables collapse to cards on phones.
- Unified Pointer Events (touch + mouse), 44px tap targets, no hover-only actions.
- Desktop: keyboard shortcuts, right-click menus. Mobile: swipe, long-press.

## Decisions
| Area | Choice |
|------|--------|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Tables | TanStack Table + TanStack Virtual |
| Data fetching / cache | TanStack Query (persisted to IndexedDB) |
| Drag & drop | dnd-kit |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth), daily keep-alive ping via GitHub Action |
| PWA | vite-plugin-pwa — installable, offline read |
| Hosting | GitHub Pages, auto-deploy on push to `main` via GitHub Actions |
| Quality | ESLint, Prettier, Vitest, CI on every push |
| Branch | All work on `main` |
