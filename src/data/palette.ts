/**
 * Every colour the app uses, read from the stylesheets at build time (so this list always
 * matches the app), with where each one appears.
 */
import appCss from '../index.css?raw'
import tailwindTheme from 'tailwindcss/theme.css?raw'
import { DEFAULT_BADGE } from './statusInfo'
import { SERIES_COLORS } from '../lib/seriesColors'

export interface Swatch {
  name: string
  hex: string
  rgb: [number, number, number]
  use: string
}

const clamp = (x: number) => Math.min(1, Math.max(0, x))
const toByte = (x: number) => {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
  return Math.round(clamp(v) * 255)
}

/** "oklch(76.5% 0.177 163.223)" → [r, g, b] (sRGB, clipped to what a screen shows). */
export function oklchToRgb(text: string): [number, number, number] | null {
  const m = text.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return null
  const L = Number(m[1]) / (m[2] ? 100 : 1)
  const C = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    toByte(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    toByte(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    toByte(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ]
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()

/** CSS variables of a stylesheet: { "--color-accent": "#22c55e", … }. */
function variables(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const app = variables(appCss)
const tw = variables(tailwindTheme)

function swatch(name: string, value: string | undefined, use: string): Swatch | null {
  if (!value) return null
  const rgb = value.startsWith('#') ? hexToRgb(value) : oklchToRgb(value)
  return rgb ? { name, hex: toHex(rgb), rgb, use } : null
}

const brand = (token: string, use: string) => swatch(token, app[`--color-${token}`], use)
const tailwind = (token: string, use: string) => swatch(token, tw[`--color-${token}`], use)
const fixed = (name: string, hex: string, use: string) => swatch(name, hex, use)

const groups: [string, string, (Swatch | null)[]][] = [
  [
    'Identity',
    'The app’s own colours: backgrounds, text and the green accent.',
    [
      brand('bg', 'Page background, phone status bar and app icon background'),
      brand('surface', 'Cards, tables, sidebar'),
      brand('surface-2', 'Inputs, table headers, selected tabs'),
      brand('border', 'Lines and borders'),
      brand('text', 'Main text'),
      brand('muted', 'Secondary text, labels, hints'),
      brand('accent', 'Buttons, links, active menu item, focus ring'),
      brand('accent-strong', 'Buttons when pressed or hovered'),
    ],
  ],
  [
    'Ratings',
    'Attributes (1–20), role scores, staff ratings and match ratings, worst to best.',
    [
      tailwind('red-400', 'Very poor (attributes 1–5); also losses and errors'),
      tailwind('amber-400', 'Poor (6–9); also warnings'),
      brand('text', 'Average (10–12)'),
      tailwind('slate-300', 'Average, on score bars'),
      tailwind('lime-300', 'Good (13–15)'),
      tailwind('emerald-400', 'Excellent (16–20); also wins and goals'),
    ],
  ],
  [
    'Signals',
    'Results, cards, warnings and badges.',
    [
      tailwind('emerald-500', 'Win badge, best spots on the position map'),
      tailwind('slate-400', 'Draw badge'),
      tailwind('red-500', 'Loss badge, red card, delete buttons'),
      tailwind('red-600', 'Delete button when pressed'),
      tailwind('yellow-400', 'Yellow card'),
      tailwind('amber-300', 'Warnings and things to check'),
      tailwind('amber-200', 'Text inside warning boxes'),
      tailwind('amber-500', 'Border of warning cards'),
      tailwind('sky-300', 'U20 / U18 badge, preferred attributes of a role'),
      tailwind('sky-400', 'Preferred-attribute chips (border)'),
      tailwind('sky-500', 'U20 / U18 badge background'),
      tailwind('slate-500', 'Away team bars in match stats'),
      tailwind('emerald-600', 'Top of the 8-step staff rating scale (How it works)'),
    ],
  ],
  [
    'Pitch',
    'Tactics and Best XI pitch.',
    [
      tailwind('emerald-950', 'Pitch'),
      tailwind('emerald-900', 'Pitch edge'),
      tailwind('emerald-800', 'Pitch lines'),
    ],
  ],
  [
    'Charts',
    'One colour per player in Compare and Development charts, in this order.',
    SERIES_COLORS.map((hex, i) => fixed(`Series ${i + 1}`, hex, `Player ${i + 1}`)),
  ],
  [
    'Status badges',
    'Default badge colours on the Statuses page (each status can have its own).',
    [
      fixed('Badge background', DEFAULT_BADGE.bg, 'Default status badge'),
      fixed('Badge text', DEFAULT_BADGE.fg, 'Default status badge'),
      fixed('Injured background', '#4c1d24', 'Injured badge'),
      fixed('Injured text', '#fca5a5', 'Injured badge'),
    ],
  ],
]

/** Every colour, by group. */
export const PALETTE: { title: string; note: string; swatches: Swatch[] }[] = groups.map(
  ([title, note, list]) => ({
    title,
    note,
    swatches: list.filter((s): s is Swatch => s !== null),
  }),
)
