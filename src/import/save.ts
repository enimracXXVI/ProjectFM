/**
 * Turns what public/fmsave/extract.py reads from an FM save (via fmsave, MIT) into
 * ProjectFM fields: the Contract and Stats columns (same keys as the FM HTML exports),
 * feet, and personality values.
 */
import type { CompetitionsFile } from '../competitions/types'
import type { SaveTactics } from '../tactics/types'
import fmNations from '../data/fmNations.json'
import { personalityName, type PersonalityRule } from '../lib/personality'
import type { KnowledgeEntry } from '../data/db'
import { EUR_PER_GBP } from '../lib/money'
import { isUnknownWord, UNKNOWN_WORD, withValue, wordOf } from '../lib/valueWord'
import {
  footWithValue,
  staffWord,
  type ImportWords,
  type Dump,
  type DumpMeta,
  type DumpPerson,
} from './dump'

export type StatsKind = 'overall' | 'league' | 'cup' | 'non_competitive'

/** Version of public/fmsave/extract.py this app expects. */
export const READER_VERSION = 11

export interface SaveData {
  /** Version of the save reader that produced this (absent before version 3). */
  reader?: number
  competitionsError?: string
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
  /** Every member of the club's staff (all teams). */
  staff?: {
    uniqueId: number
    name: string
    lastName: string | null
    commonName: string | null
    age: number | null
    nation: number | null
    job: number
    team: number
    attributes: Record<string, number> | null
    personality: Record<string, number> | null
    contractEnd: string | null
    wage: number | null
  }[]
  /** First-team tactics and current selection. */
  tactics?: SaveTactics | null
  tacticsError?: string
  /** This season's competitions (uploaded separately, removed once read). */
  competitions?: Omit<CompetitionsFile, 'version'> | null
  /** Every player in Reader dump shape, nations as FM database ids (removed once read). */
  dump?: { meta: DumpMeta; players: (DumpPerson & { natDb?: number[] })[]; staff: [] }
  /** The club's scouts (absent in saves read before scouts were added). */
  scouts?: {
    uniqueId: number
    name: string
    age: number | null
    chief: boolean
    attributes: Record<string, number> | null
    personality?: Record<string, number> | null
    /** Nation is the FM database id; value 0–100. */
    knowledge: { nation: number | null; value: number }[]
  }[]
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
export function saveUpdates(
  data: SaveData,
  kind: StatsKind,
  words?: ImportWords,
): SavePlayerUpdate[] {
  return data.players.map((p) => {
    const contract = data.contracts.find((c) => c.uniqueId === p.uniqueId)
    const stats = data.stats.find((s) => s.uniqueId === p.uniqueId && s.kind === kind)
    return {
      uniqueId: p.uniqueId,
      leftFoot: p.leftFoot ? footWithValue(p.leftFoot, words?.footWords, words?.footMins) : null,
      rightFoot: p.rightFoot ? footWithValue(p.rightFoot, words?.footWords, words?.footMins) : null,
      contract: contract ? contractFields(contract) : null,
      stats: stats ? statsFields(stats) : null,
    }
  })
}

/**
 * FM27 knowledge words for the save's 0–100 value, as checked against the staff screen of
 * seven scouts (Victor, Braund, Giani, Vázquez, Doné, Amaral, Arenz).
 * Stored with the value, "Very Good (36)"; values not confirmed yet are "Unknown (n)".
 */
export const KNOWLEDGE_WORDS: Record<number, string> = {
  30: 'Very Good',
  36: 'Very Good',
  48: 'Extensive',
  50: 'Extensive',
  60: 'Exceptional',
  75: 'Exceptional',
  90: 'Outstanding',
  100: 'Complete',
}
export const knowledgeWord = (n: number) => withValue(KNOWLEDGE_WORDS[n] ?? UNKNOWN_WORD, n)
export const isUnconfirmedKnowledge = isUnknownWord

const NATIONS = fmNations as Record<string, string>
/** Nation name for an FM database id (names taken from the user's own dump). */
export const fmNation = (id: number | null) =>
  id == null ? 'Unknown nation' : (NATIONS[String(id)] ?? `Nation #${id}`)

/**
 * Save staff attribute → FM27 label. The save holds most of them ×5 (17 shows as 85);
 * Adaptability and Authority are stored 1–20 as shown.
 */
const SCOUT_ATTR: [string, string, number][] = [
  ['analysing_data', 'Analysing Data', 5],
  ['adaptability', 'Adaptability', 1],
  ['determination', 'Determination', 5],
  ['motivating', 'Motivating', 5],
  ['people_management', 'People Management', 5],
  ['authority', 'Authority', 1],
  ['judging_player_ability', 'Judging Player Ability', 5],
  ['judging_player_potential', 'Judging Player Potential', 5],
  ['judging_staff_ability', 'Judging Staff Ability', 5],
  ['negotiating', 'Negotiating', 5],
  ['tactical_knowledge', 'Tactical Knowledge', 5],
]

export interface SaveScout {
  fm_uid: number
  name: string
  age: number | null
  role: 'Scout' | 'Chief Scout'
  personality: string | null
  attributes: Record<string, string>
  knowledge: KnowledgeEntry[]
}

/** The save's scouts as ProjectFM staff: rating words and knowledge per nation. */
export function saveScouts(data: SaveData, rules?: PersonalityRule[]): SaveScout[] {
  return (data.scouts ?? []).map((s) => {
    const attributes: Record<string, string> = {}
    for (const [key, label, scale] of SCOUT_ATTR) {
      const v = s.attributes?.[key]
      if (typeof v === 'number' && v > 0) {
        const n = Math.floor(v / scale)
        attributes[label] = withValue(staffWord(n), n)
      }
    }
    return {
      fm_uid: s.uniqueId,
      name: s.name,
      age: s.age,
      role: s.chief ? 'Chief Scout' : 'Scout',
      // Staff determination is stored ×5, like the other staff attributes
      personality: s.personality
        ? personalityName(
            {
              ...s.personality,
              determination:
                typeof s.attributes?.determination === 'number'
                  ? Math.floor(s.attributes.determination / 5)
                  : undefined,
            },
            rules,
          )
        : null,
      attributes,
      knowledge: s.knowledge.map((k) => ({
        nation: fmNation(k.nation),
        level: knowledgeWord(k.value),
      })),
    }
  })
}

/**
 * New knowledge list for a scout: the save's nations and values, but where the save's
 * value has no confirmed word yet and the user already set one for that nation, the
 * user's word is kept next to the save's value: "Exceptional (75)".
 */
export function mergeKnowledge(fromSave: KnowledgeEntry[], current: KnowledgeEntry[]) {
  return fromSave.map((k) => {
    if (!isUnconfirmedKnowledge(k.level)) return k
    const mine = current.find((c) => c.nation === k.nation)
    if (!mine || isUnconfirmedKnowledge(mine.level)) return k
    const value = k.level.match(/\d+/)![0]
    return { nation: k.nation, level: `${wordOf(mine.level)} (${value})` }
  })
}

/** The save's players as a Reader dump (nation ids turned into names). */
export function dumpFromSave(data: SaveData): Dump {
  if (!data.dump) throw new Error('This save was read without its player list.')
  const players = data.dump.players.map(({ natDb, ...p }) => ({
    ...p,
    nat: (natDb ?? []).map(fmNation),
  }))
  return { meta: data.dump.meta, players, staff: [] }
}

/** True for a dump made from an FM save. */
export const isSaveDump = (meta: DumpMeta) => meta.source === 'FM save'
