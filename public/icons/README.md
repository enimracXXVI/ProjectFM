# App icons

Placeholders showing the repo name. Replace each file with your own design, **keeping the same file name and size**. No code changes needed.

| File                   | Size                 | Used for                                                                                                                                                               |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favicon.svg`          | any (square, vector) | Browser tab icon (modern browsers)                                                                                                                                     |
| `favicon-32.png`       | 32×32                | Browser tab icon (fallback)                                                                                                                                            |
| `apple-touch-icon.png` | 180×180              | iPhone / iPad home screen. No transparency; iOS rounds corners itself.                                                                                                 |
| `icon-192.png`         | 192×192              | Android home screen, app switcher                                                                                                                                      |
| `icon-512.png`         | 512×512              | Install prompt, splash screen                                                                                                                                          |
| `maskable-512.png`     | 512×512              | Android adaptive icon. Keep logo inside the central circle (~80% / 410px); edges may be cropped to circle, squircle, etc. Fill the full square with background colour. |

`icon.svg` and `maskable.svg` are just the sources the placeholders were made from; they can be deleted once you have your own.

App name, colours and other install settings live in the `manifest` section of `vite.config.ts`.
Preview how a maskable icon gets cropped: https://maskable.app
