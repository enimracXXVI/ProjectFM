/**
 * Turns what public/fmsave/extract.py reads from an FM save (via fmsave, MIT) into
 * ProjectFM fields: the Contract and Stats columns (same keys as the FM HTML exports),
 * feet, and personality values.
 */
import { EUR_PER_GBP } from '../lib/money'
import { footWord } from './dump'

export type StatsKind = 'overall' | 'league' | 'cup' | 'non_competitive'

export interface SaveData {
  club: string
  gameDate: string | null
  players: {
    uniqueId: number
    name: string
    leftFoot: number | null
    rightFoot: number | null
    personality: Record<string, number> | null
  }[]
  contracts: {
    uniqueId: number
    wage: number | null
    end: string | null
    squadStatus: string | null
    kind: string | null
    onLoan: boolean
    clauses: { kind: string; value: number | null }[]
  }[]
  stats: (Record<string, number | string | null> & { uniqueId: number; kind: string })[]
}

/** Money as FM writes it: €2.84M, €13.25K, €950. */
export function fmEuro(eur: number): string {
  const trim = (n: number) => String(Math.round(n * 100) / 100)
  if (Math.abs(eur) >= 1e6) return `€${trim(eur / 1e6)}M`
  if (Math.abs(eur) >= 1e3) return `€${trim(eur / 1e3)}K`
  return `€${Math.round(eur)}`
}

const words = (code: string) =>
  code
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const CONTRACT_KIND: Record<string, string> = {
  full_time: 'Full Time',
  youth: 'Youth Contract',
}

/** FM date (yyyy-mm-dd) as the exports show it: d/m/yyyy. */
const fmDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${m}/${y}`
}

/** Contract columns, keyed like FM's contract view export. */
export function contractFields(c: SaveData['contracts'][number]): Record<string, string> {
  const out: Record<string, string> = {}
  if (c.squadStatus && c.squadStatus !== 'unknown') out['Playing Time'] = words(c.squadStatus)
  if (c.kind && c.kind !== 'unknown')
    out['Contract Status'] = CONTRACT_KIND[c.kind] ?? words(c.kind)
  if (c.wage != null) out.Wage = `${fmEuro(c.wage * 52 * EUR_PER_GBP)} p/a`
  if (c.end) out.Expires = fmDate(c.end)
  const release = c.clauses.find((x) => x.kind === 'minimum_fee_release' && x.value != null)
  if (release) out['Minimum Fee Release Clause'] = fmEuro(release.value! * EUR_PER_GBP)
  if (c.clauses.some((x) => x.kind === 'optional_extension_by_club'))
    out['Optional Contract Extension By Club'] = 'Yes'
  return out
}

const num = (v: unknown) => (typeof v === 'number' ? v : 0)
const dp2 = (n: number) => n.toFixed(2)
const per90 = (v: unknown, minutes: number) => dp2(minutes > 0 ? (num(v) / minutes) * 90 : 0)
const pct = (a: unknown, b: unknown) => `${num(b) > 0 ? Math.round((num(a) / num(b)) * 100) : 0}%`

/** Stats columns, keyed like FM's stats view export where the save has the figure. */
export function statsFields(s: SaveData['stats'][number]): Record<string, string> {
  const min = num(s.minutes)
  const subs = num(s.substitute_appearances)
  const out: Record<string, string> = {
    Apps: subs ? `${num(s.starts)} (${subs})` : String(num(s.starts)),
    Minutes: String(min),
    Goals: String(num(s.goals)),
    xG: dp2(num(s.expected_goals)),
    'xG/90': per90(s.expected_goals, min),
    'Conv %': pct(s.goals, s.shots),
    Assists: String(num(s.assists)),
    xA: dp2(num(s.expected_assists)),
    'xA/90': per90(s.expected_assists, min),
    'Drb/90': per90(s.dribbles, min),
    'OP-KP/90': per90(s.open_play_key_passes, min),
    'Pr passes/90': per90(s.progressive_passes, min),
    'Hdr %': pct(s.headers_won, s.aerial_challenges_attempted),
    MLG: String(num(s.mistakes_leading_to_goal)),
    'Int/90': per90(s.interceptions, min),
    'Tck R': pct(s.tackles_completed, s.tackles_attempted),
    'Tck/90': per90(s.tackles_completed, min),
    'K Tck/90': per90(s.key_tackles, min),
    'Cr C/A': pct(s.crosses_completed, s.crosses_attempted),
    'Crs A/90': per90(s.crosses_attempted, min),
    // Extra figures the save has (add them under Settings → Contract & Stats)
    Starts: String(num(s.starts)),
    'Sub apps': String(subs),
    'Player of the Match': String(num(s.player_of_the_match)),
    Shots: String(num(s.shots)),
    'Shots on target': String(num(s.shots_on_target)),
    'Key passes': String(num(s.key_passes)),
    'Pass %': pct(s.passes_completed, s.passes_attempted),
    'Clear-cut chances': String(num(s.clear_cut_chances_created)),
    'Distance (km)': String(num(s.distance_km)),
    'Yellow cards': String(num(s.yellow_cards)),
    'Red cards': String(num(s.red_cards)),
    'Clean sheets': String(num(s.clean_sheets)),
    'xG prevented': dp2(num(s.expected_goals_prevented)),
  }
  if (typeof s.average_rating === 'number') out.Rating = dp2(s.average_rating)
  return out
}

export interface SavePlayerUpdate {
  uniqueId: number
  leftFoot: string | null
  rightFoot: string | null
  /** Contract columns, or null when the save has no contract for the player. */
  contract: Record<string, string> | null
  /** Stats columns for the chosen competition, or null when the player has none. */
  stats: Record<string, string> | null
}

/** All stats keys the save import writes (cleared before new stats are written). */
export const SAVE_STATS_KEYS = Object.keys(
  statsFields({ uniqueId: 0, kind: 'overall', average_rating: 1 }),
)
/** All contract keys the save import writes. */
export const SAVE_CONTRACT_KEYS = [
  'Playing Time',
  'Contract Status',
  'Wage',
  'Expires',
  'Minimum Fee Release Clause',
  'Optional Contract Extension By Club',
]

/** What the save import changes per player, for one competition kind. */
export function saveUpdates(data: SaveData, kind: StatsKind): SavePlayerUpdate[] {
  return data.players.map((p) => {
    const contract = data.contracts.find((c) => c.uniqueId === p.uniqueId)
    const stats = data.stats.find((s) => s.uniqueId === p.uniqueId && s.kind === kind)
    return {
      uniqueId: p.uniqueId,
      leftFoot: p.leftFoot ? footWord(p.leftFoot) : null,
      rightFoot: p.rightFoot ? footWord(p.rightFoot) : null,
      contract: contract ? contractFields(contract) : null,
      stats: stats ? statsFields(stats) : null,
    }
  })
}
