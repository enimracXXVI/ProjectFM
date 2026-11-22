import type { RoleDef } from '../data/roles'
import type { TrainingFocus } from './focus'

/**
 * A player's individual training as the save stores it (save reader 25), kept in the player's
 * extra fields by the import. Found by ProjectFM on the user's FM27 saves by changing one
 * setting at a time in game.
 */
export const TRAINING_KEYS = {
  ip: 'Training role (IP)',
  oop: 'Training role (OOP)',
  focus: 'Training focus',
  intensity: 'Training intensity',
  rest: 'Training rest until',
  asOf: 'Training as of',
} as const

/** The save's individual training of one player, as the reader gives it. */
export interface SaveTraining {
  ipRole?: number
  oopRole?: number
  focus?: number | null
  intensity?: 'auto' | 'half' | 'normal' | 'double'
  restUntil?: string | null
}

/** The extra fields the import writes for a player's training. */
export function trainingFields(
  t: SaveTraining | null | undefined,
  gameDate: string | null,
): Record<string, string> {
  if (!t) return {}
  const out: Record<string, string> = { [TRAINING_KEYS.asOf]: gameDate ?? '' }
  if (t.ipRole != null) out[TRAINING_KEYS.ip] = String(t.ipRole)
  if (t.oopRole != null) out[TRAINING_KEYS.oop] = String(t.oopRole)
  if (t.focus !== undefined) out[TRAINING_KEYS.focus] = t.focus == null ? '' : String(t.focus)
  if (t.intensity) out[TRAINING_KEYS.intensity] = t.intensity
  if (t.restUntil !== undefined) out[TRAINING_KEYS.rest] = t.restUntil ?? ''
  return out
}

/** How the save numbers the roles players train. */
export interface TrainingRoleCodes {
  /**
   * In-possession role number (the save's value divided by 64; the rest is the position) →
   * role id. Only the ones seen in the user's saves; others show as unknown.
   */
  ip: Record<string, string>
  /**
   * Out-of-possession roles in FM's own order (FM27's code): the save stores the place in this
   * list minus 32. The first is no role.
   */
  oop: (string | null)[]
  /** The save's out-of-possession value for None (outfield players). */
  oopNone: number
}

export const DEFAULT_TRAINING_ROLE_CODES: TrainingRoleCodes = {
  // Checked against the user's training screen and tactics (Nov 2026)
  ip: {
    '18': 'chm',
    '98': 'cb-ip',
    '99': 'fb-ip',
    '100': 'wb-ip',
    '102': 'cm-ip',
    '108': 'bgk',
    '111': 'dlp',
    '114': 'tf',
    '117': 'bcb',
    '118': 'if',
  },
  // FM27's out-of-possession role list; checked on CB, Covering CB, FB, Pressing FB, DM,
  // Pressing CM, Centre Forward, Goalkeeper and None
  oop: [
    null,
    'gk-oop',
    'sk',
    'lhk',
    'cb-oop',
    'scb',
    'ccb',
    'wcb-oop',
    'swd',
    'cwd',
    'fb-oop',
    'pfb',
    'hfb',
    'wb-oop',
    'pwb-oop',
    'hwb',
    'dm-oop',
    'ddm',
    'pdm',
    'sdm',
    'wdm',
    'cm-oop',
    'pcm',
    'scm',
    'wcm-oop',
    'am-oop',
    'tam',
    'oam',
    'sam',
    'wmf',
    'twm',
    'owm',
    'w-oop',
    'tw',
    'iow',
    'wow',
    'cfd-oop',
    'tcf',
    'ocf',
    'scf',
  ],
  oopNone: 50,
}

export function isTrainingRoleCodes(v: unknown): v is TrainingRoleCodes {
  return (
    !!v &&
    typeof v === 'object' &&
    'ip' in v &&
    'oop' in v &&
    Array.isArray((v as TrainingRoleCodes).oop)
  )
}

/**
 * The in-possession role a player trains: the role, "playing position", or the number when it
 * is not known. Read from the save (a number) or set in the app ("role:<id>", "playing").
 */
export function ipTrainingRole(
  raw: string | undefined,
  codes: TrainingRoleCodes,
  roles: RoleDef[],
): { role: RoleDef | null; code: number | null; playing?: boolean } | null {
  if (!raw) return null
  if (raw === PLAYING) return { role: null, code: null, playing: true }
  if (raw.startsWith('role:'))
    return { role: roles.find((r) => r.id === raw.slice(5)) ?? null, code: null }
  if (!/^\d+$/.test(raw)) return null
  const code = Number(raw) >> 6
  const id = codes.ip[String(code)]
  return { role: roles.find((r) => r.id === id) ?? null, code }
}

/**
 * The out-of-possession role a player trains: the role, None, or the number. Read from the save
 * (a number) or set in the app ("role:<id>", "none").
 */
export function oopTrainingRole(
  raw: string | undefined,
  codes: TrainingRoleCodes,
  roles: RoleDef[],
): { role: RoleDef | null; none: boolean; code: number | null } | null {
  if (!raw) return null
  if (raw === NONE) return { role: null, none: true, code: null }
  if (raw.startsWith('role:'))
    return { role: roles.find((r) => r.id === raw.slice(5)) ?? null, none: false, code: null }
  if (!/^-?\d+$/.test(raw)) return null
  const n = Number(raw)
  if (n === codes.oopNone) return { role: null, none: true, code: n }
  const id = codes.oop[n + 32]
  if (id === null) return { role: null, none: true, code: n }
  return { role: roles.find((r) => r.id === id) ?? null, none: false, code: n }
}

/** Values set in the app for "Playing position" (in possession) and None (out of possession). */
export const PLAYING = 'playing'
export const NONE = 'none'

/** Rest options FM offers next to the intensities (days without pitch or gym work). */
export const REST_DAYS: [number, string][] = [
  [1, '1 day'],
  [2, '2 days'],
  [3, '3 days'],
  [4, '4 days'],
  [5, '5 days'],
  [6, '6 days'],
  [7, '1 week'],
  [14, '2 weeks'],
]

/** The first day back from a rest of n days starting the day after `from` (as FM stores it). */
export function restBack(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days + 1)
  return d.toISOString().slice(0, 10)
}

export const INTENSITY_TEXT: Record<string, string> = {
  auto: 'Automatic',
  half: 'Half intensity',
  normal: 'Normal intensity',
  double: 'Double intensity',
}

/** The focus a player trains, by FM's focus code ('' none). */
export function focusOf(raw: string | undefined, list: TrainingFocus[]) {
  if (raw === undefined) return undefined
  if (raw === '') return null
  return list.find((f) => f.code === Number(raw)) ?? { code: Number(raw), name: `Focus ${raw}` }
}

/**
 * Rest (no pitch or gym work): the save keeps the first day back. Days left are counted from
 * the game date; none when the rest is over or unset.
 */
export function restDaysLeft(back: string | undefined, gameDate: string | null | undefined) {
  if (!back || !gameDate) return null
  // Set on 19 Dec for 2 days: off 20 and 21 Dec, back on 22 Dec (seen in game)
  const days = Math.round((Date.parse(back) - Date.parse(gameDate)) / 86_400_000) - 1
  return days > 0 ? days : null
}
