# ProjectFM

Companion web app for Football Manager careers: squads, staff, scouting, stats and achievements. Installable PWA for phone and desktop.

See [PLAN.md](PLAN.md) for scope and decisions, [TODO.md](TODO.md) for what's next.

Live: https://enimracxxvi.github.io/ProjectFM/ (after GitHub Pages is enabled)

## Development

```sh
npm install
npm run dev      # local dev server
npm run check    # lint + format + typecheck + tests
npm run build    # production build in dist/
```

Every push to `main` runs the checks and deploys to GitHub Pages.

App icons: see [public/icons/README.md](public/icons/README.md).
