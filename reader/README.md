# ProjectFM Reader

Reads Football Manager 27's loaded database while the game runs (read-only, it never writes to
the game) and saves it to `%LOCALAPPDATA%\ProjectFM\dump.json` for importing into ProjectFM.

Based on [FMSuperScout](https://github.com/mavarobli/FMSuperScout) by mavarobli (MIT licence,
see `LICENSE-FMSuperScout`), copied from commit `43de222`. ProjectFM changes, all marked
`ProjectFM` in the code:

- Output folder `%LOCALAPPDATA%\ProjectFM` (does not touch FMSuperScout's files).
- Extra fields per player: `footLeft` / `footRight` (1–20), `posRatings` (1–20 for every
  position), `squadNo`, `condition`, `morale`. Squad number, condition and morale use offsets
  FMSuperScout had mapped but not used, so they are unverified on FM27.
- Starts in F9-watch mode when double-clicked, with English instructions in its window.

## Use

1. Start FM27 and load your save.
2. Double-click `ProjectFM.Reader.exe` (Windows may warn that it is not signed: More info → Run
   anyway). Keep its window open.
3. Press **F9** in FM. A few seconds later `dump.json` is updated.
4. In ProjectFM, Import → choose `%LOCALAPPDATA%\ProjectFM\dump.json`.

Don't run FMSuperScout's own reader at the same time: both would scan on every F9.

## Build

GitHub builds the exe on every change under `reader/` (workflow "ProjectFM Reader"; download
from the run's Artifacts). Locally: `dotnet publish reader/scanner/ProjectFM.Reader.csproj -c Release`.
