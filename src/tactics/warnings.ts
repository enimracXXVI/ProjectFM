/**
 * FM's own warnings about role combinations (texts from FM27's language file, editable in
 * Settings > Tactics). FM's file has the texts but not the rules behind them: each rule here
 * follows the warning's own words, and the "too many" limits are the app's (editable), since
 * FM's own numbers are not in its files.
 */
import type { RoleDef } from '../data/roles'
import { FM_TEXTS, fmPositions, posOf, roleIdOf, type FmCodes } from './fm'
import type { TacticSlot } from './types'

export interface RoleWarning {
  /** FM's text id. */
  id: string
  text: string
  on: boolean
  /** For "too many" warnings: how many roles of the kind trigger it. */
  limit?: number
}

const LIMITS: Record<string, number> = {
  '696127': 3,
  '696128': 3,
  '696129': 3,
  '696131': 2,
  '696132': 2,
  '696133': 2,
}

export const DEFAULT_ROLE_WARNINGS: RoleWarning[] = Object.entries(FM_TEXTS.warnings).map(
  ([id, text]) => ({ id, text, on: true, ...(LIMITS[id] ? { limit: LIMITS[id] } : {}) }),
)

/** What each rule checks, in plain words (shown in Settings). */
export const WARNING_RULES: Record<string, string> = {
  '696119':
    'In possession: a role that drops into central defence (Half Back, Inside Full-Back) with three or more centre-backs.',
  '696121':
    'In possession: a role that moves up to AM (C) (Box-To-Box Midfielder or Playmaker) when the shape already has an AM (C).',
  '696124':
    'In possession: two inverting wide roles (Inside Full-Back, Inside or Playmaking Wing-Back, Inside or Playmaking Winger) on the same side.',
  '696126':
    'Out of possession: two or more Stopping centre-backs and no Covering one, or the other way round.',
  '696127':
    'Out of possession: this many outlet roles (Wide, Inside, Central or Splitting Outlet).',
  '696128': 'Out of possession: this many Screening or Holding roles.',
  '696129': 'Out of possession: this many Pressing roles.',
  '696131': 'Out of possession: this many Dropping Defensive Midfielders.',
  '696132': 'Out of possession: this many Tracking roles.',
  '696133': 'Out of possession: this many Wide Covering midfielders.',
  '707738': 'Out of possession: the only DM is a Pressing Defensive Midfielder.',
  '707739': 'Out of possession: the only DM is a Dropping Defensive Midfielder.',
}

const DROPS_TO_CB = ['hb', 'ifb']
const MOVES_UP_TO_AMC = ['bbm', 'bbp']
const INVERTING = ['ifb', 'iwb', 'pwb-ip', 'iw', 'pw']
const STOPPING = ['scb', 'swd']
const COVERING = ['ccb', 'cwd']
const KINDS: Record<string, string[]> = {
  '696127': ['wow', 'iow', 'owm', 'oam', 'sam', 'ocf', 'scf'],
  '696128': ['sdm', 'scm', 'hfb', 'hwb'],
  '696129': ['pfb', 'pwb-oop', 'pdm', 'pcm'],
  '696131': ['ddm'],
  '696132': ['twm', 'tw', 'tam', 'tcf'],
  '696133': ['wdm', 'wcm-oop'],
}
const LEFT = ['DL', 'WBL', 'ML', 'AML']
const RIGHT = ['DR', 'WBR', 'MR', 'AMR']

const article = (name: string) => (/^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`)

/** FM's warnings that apply to this tactic, with the role names filled in. */
export function roleWarnings(
  slots: TacticSlot[],
  roles: RoleDef[],
  warnings: RoleWarning[],
  codes: FmCodes,
): string[] {
  const out: string[] = []
  const ip = slots.map((s) => roleIdOf(s, 'ip'))
  const oop = slots.map((s) => roleIdOf(s, 'oop'))
  const posIp = slots.map((s) => posOf(s, 'ip'))
  const posOop = slots.map((s) => posOf(s, 'oop'))
  const nameOf = (id: string | null | undefined) => roles.find((r) => r.id === id)?.name ?? id ?? ''
  const say = (w: RoleWarning, role?: string | null) =>
    out.push(
      w.text
        .replace('{a role}', role ? article(nameOf(role)) : 'this role')
        .replace('{role}', role ? nameOf(role) : 'this'),
    )
  const sides = fmPositions(slots, 'ip', codes)
  for (const w of warnings) {
    if (!w.on) continue
    const count = (ids: string[]) => oop.filter((r) => r && ids.includes(r)).length
    switch (w.id) {
      case '696119':
        if (posIp.filter((p) => p === 'DC').length >= 3)
          for (const r of new Set(ip.filter((r) => r && DROPS_TO_CB.includes(r)))) say(w, r)
        break
      case '696121':
        if (posIp.includes('AMC'))
          for (const r of new Set(ip.filter((r) => r && MOVES_UP_TO_AMC.includes(r)))) say(w, r)
        break
      case '696124': {
        const side = (list: string[]) =>
          slots.filter((_, i) => {
            const p = posIp[i]
            // Paired central slots never count; wide slots by their position
            return p && list.includes(p) && sides[i] && ip[i] && INVERTING.includes(ip[i]!)
          }).length
        if (side(LEFT) >= 2 || side(RIGHT) >= 2) say(w)
        break
      }
      case '696126': {
        const st = count(STOPPING)
        const cv = count(COVERING)
        if ((st >= 2 && !cv) || (cv >= 2 && !st)) say(w)
        break
      }
      case '707738':
      case '707739': {
        const dms = slots.map((_, i) => i).filter((i) => posOop[i] === 'DM')
        const want = w.id === '707738' ? 'pdm' : 'ddm'
        if (dms.length === 1 && oop[dms[0]] === want) say(w)
        break
      }
      default:
        if (KINDS[w.id] && w.limit && count(KINDS[w.id]) >= w.limit) say(w)
    }
  }
  return out
}
