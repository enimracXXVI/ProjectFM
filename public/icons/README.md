# App icons

The ProjectFM logo. Replace a file with a new design of the same name and size; no code changes needed.

| File                   | Size    | Used for                                                                                               |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `favicon-16.png`       | 16×16   | Browser tab icon                                                                                       |
| `favicon-32.png`       | 32×32   | Browser tab icon (sharper screens)                                                                     |
| `apple-touch-icon.png` | 180×180 | iPhone / iPad home screen. No transparency; iOS rounds corners itself. Made from the 512.              |
| `icon-192.png`         | 192×192 | Android home screen, app switcher                                                                      |
| `icon-512.png`         | 512×512 | Install prompt, splash screen                                                                          |
| `maskable-512.png`     | 512×512 | Android adaptive icon: same as the 512, whose logo already sits inside the circle Android may crop to. |

App name, colours and other install settings live in the `manifest` section of `vite.config.ts`.
