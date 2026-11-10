/**
 * Reads an FMSuperScout dump.json (written by FMSuperScout's reader when you press F9 in FM).
 * Format reference: FMSuperScout core/Dumper.cs (MIT). Staff attribute keys in the dump are
 * Dutch; the mapping below was checked value by value against FM27's staff screen for 10 scouts.
 */
import type { ImportedPlayer } from './parse'

export interface DumpMeta {
  game?: string
  gameVersion?: string
  gameDate?: string
  manager?: string
  myClub?: string
  currency?: string
  source?: string
}

export interface DumpPerson {
  id: number
  name: string
  age?: number
  nat?: string[]
  club?: string
  ownerClub?: string
  ca?: number
  pa?: number
  height?: number
  posArr?: string[]
  teamType?: number
  attrs?: Record<string, number>
  job?: string
  jobId?: number
  adaptability?: number
  ambition?: number
  loyalty?: number
  professionalism?: number
  pressure?: number
  sportsmanship?: number
  temperament?: number
  controversy?: number
  staffAttrs?: Record<string, number>
}

export interface Dump {
  meta: DumpMeta
  players: DumpPerson[]
  staff: DumpPerson[]
}

/** Dump attribute key → ProjectFM attribute name (only where they differ by more than spacing). */
const PLAYER_ATTR: Record<string, string> = {
  LongShots: 'Long Shots',
  OffTheBall: 'Off The Ball',
  PenaltyTaking: 'Penalty Taking',
  AerialReach: 'Aerial Reach',
  CommandOfArea: 'Command Of Area',
  OneOnOnes: 'One On Ones',
  FirstTouch: 'First Touch',
  Teamwork: 'Team Work',
  WorkRate: 'Work Rate',
  LongThrows: 'Long Throws',
  RushingOut: 'Rushing Out (Tendency)',
  Punching: 'Punching (Tendency)',
  FreeKicks: 'Free Kick Taking',
  JumpingReach: 'Jumping Reach',
  NaturalFitness: 'Natural Fitness',
}

/** FM's hidden player attributes, kept apart (shown only with Settings → hidden values on). */
export const HIDDEN_PLAYER_ATTRS = [
  'Consistency',
  'Dirtiness',
  'Important Matches',
  'Injury Proneness',
  'Versatility',
]
const HIDDEN_KEY: Record<string, string> = {
  Consistency: 'Consistency',
  Dirtiness: 'Dirtiness',
  ImportantMatches: 'Important Matches',
  InjuryProneness: 'Injury Proneness',
  Versatility: 'Versatility',
}

/** Personality values (hidden in FM). */
export const PERSONALITY_KEYS = [
  ['ambition', 'Ambition'],
  ['loyalty', 'Loyalty'],
  ['professionalism', 'Professionalism'],
  ['adaptability', 'Adaptability'],
  ['pressure', 'Pressure'],
  ['sportsmanship', 'Sportsmanship'],
  ['temperament', 'Temperament'],
  ['controversy', 'Controversy'],
] as const

/** Values that FM keeps hidden; stored in `extra` and shown only when the user allows it. */
export const HIDDEN_EXTRA_KEYS = new Set([
  'CA',
  'PA',
  ...HIDDEN_PLAYER_ATTRS,
  ...PERSONALITY_KEYS.map(([, label]) => label),
])

/**
 * Staff attributes on FM27's Scouting tab. Authority is missing on purpose: no value in the
 * dump matches FM's Authority (the dump's "KV_distributie" disagreed for all 10 scouts checked).
 */
const STAFF_ATTR: Record<string, string> = {
  Data_analyse: 'Analysing Data',
  Aanpassingsvermogen: 'Adaptability',
  Vastberadenheid: 'Determination',
  Motiveren: 'Motivating',
  'Man-management': 'People Management',
  Oordeel_vermogen: 'Judging Player Ability',
  Oordeel_potentie: 'Judging Player Potential',
  Oordeel_staf: 'Judging Staff Ability',
  Onderhandelen: 'Negotiating',
  Tactische_kennis: 'Tactical Knowledge',
}

/** FM job ids for scouting staff. */
export const JOB_SCOUT = 14
export const JOB_CHIEF_SCOUT = 44

/** FM27 staff rating word for a 1–20 value. */
export function staffWord(n: number): string {
  if (n <= 3) return 'Unsuited'
  if (n <= 6) return 'Reasonable'
  if (n <= 9) return 'Competent'
  if (n <= 11) return 'Average'
  if (n <= 14) return 'Good'
  if (n <= 17) return 'Very Good'
  if (n <= 19) return 'Outstanding'
  return 'Elite'
}

/** ["AMR", "AMC", "MC"] → "M (C), AM (RC)", in FM's own order and notation. */
export function formatPositions(codes: string[] | undefined): string | null {
  if (!codes?.length) return null
  const parse = (c: string): [string, string] => {
    if (c === 'GK' || c === 'DM' || c === 'SW') return [c, '']
    if (c === 'ST') return ['ST', 'C']
    const m = c.match(/^(AM|WB|D|M)([LRC])$/)
    return m ? [m[1], m[2]] : [c, '']
  }
  const order = ['GK', 'SW', 'D', 'WB', 'DM', 'M', 'AM', 'ST']
  const sides = new Map<string, Set<string>>()
  for (const c of codes) {
    const [base, side] = parse(c)
    if (!sides.has(base)) sides.set(base, new Set())
    if (side) sides.get(base)!.add(side)
  }
  return [...sides.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([base, s]) => {
      const ordered = ['R', 'L', 'C'].filter((x) => s.has(x)).join('')
      return ordered ? `${base} (${ordered})` : base
    })
    .join(', ')
}

/** A dump player as a ProjectFM import row (attributes, profile, hidden values in extra). */
export function playerFromDump(p: DumpPerson): ImportedPlayer {
  const attributes: Record<string, number> = {}
  const extra: Record<string, string> = {}
  for (const [k, v] of Object.entries(p.attrs ?? {})) {
    if (HIDDEN_KEY[k]) extra[HIDDEN_KEY[k]] = String(v)
    else attributes[PLAYER_ATTR[k] ?? k] = v
  }
  if (p.ca) extra.CA = String(p.ca)
  if (p.pa) extra.PA = String(p.pa)
  for (const [key, label] of PERSONALITY_KEYS) {
    const v = p[key]
    if (typeof v === 'number' && v > 0) extra[label] = String(v)
  }
  return {
    fm_uid: p.id,
    name: p.name,
    positions: formatPositions(p.posArr),
    squad_number: null,
    age: p.age ?? null,
    nation: p.nat?.[0] ?? null,
    second_nation: p.nat?.[1] ?? null,
    height_cm: p.height ?? null,
    left_foot: null,
    right_foot: null,
    personality: null,
    attributes,
    extra,
  }
}

/** Fields a dump import provides; everything else on a player is left as it was. */
export const DUMP_PRESENT = {
  core: new Set(['fm_uid', 'name', 'positions', 'age', 'nation', 'second_nation', 'height_cm']),
  attributes: null as Set<string> | null, // all attributes in the dump
  extra: HIDDEN_EXTRA_KEYS,
}

export interface DumpStaff {
  fm_uid: number
  name: string
  role: 'Scout' | 'Chief Scout'
  age: number | null
  nation: string | null
  attributes: Record<string, string>
}

export function staffFromDump(s: DumpPerson): DumpStaff {
  const attributes: Record<string, string> = {}
  for (const [k, label] of Object.entries(STAFF_ATTR)) {
    const v = s.staffAttrs?.[k]
    if (typeof v === 'number') attributes[label] = staffWord(v)
  }
  return {
    fm_uid: s.id,
    name: s.name,
    role: s.jobId === JOB_CHIEF_SCOUT ? 'Chief Scout' : 'Scout',
    age: s.age ?? null,
    nation: s.nat?.[0] ?? null,
    attributes,
  }
}

export type TeamLevel = 'first' | 'other'
export const teamLevel = (p: DumpPerson): TeamLevel => ((p.teamType ?? 0) === 0 ? 'first' : 'other')

export interface DumpSummary {
  meta: DumpMeta
  totalPlayers: number
  totalStaff: number
  /** My club's players, first team and other teams (reserves / youth). */
  players: { player: ImportedPlayer; level: TeamLevel }[]
  scouts: DumpStaff[]
  /** Current club of each requested Unique ID (to spot players who left). */
  clubOf: Record<number, string | null>
}

/** Picks out what ProjectFM imports from a parsed dump. */
export function summarizeDump(dump: Dump, knownUids: number[]): DumpSummary {
  const club = dump.meta.myClub
  if (!club) throw new Error('This dump does not say which club you manage.')
  const mine = dump.players.filter((p) => p.club === club && p.name !== '?')
  const scouts = dump.staff.filter(
    (s) => s.club === club && (s.jobId === JOB_SCOUT || s.jobId === JOB_CHIEF_SCOUT),
  )
  const want = new Set(knownUids)
  const clubOf: Record<number, string | null> = {}
  for (const p of dump.players) if (want.has(p.id)) clubOf[p.id] = p.club ?? null
  return {
    meta: dump.meta,
    totalPlayers: dump.players.length,
    totalStaff: dump.staff.length,
    players: mine.map((p) => ({ player: playerFromDump(p), level: teamLevel(p) })),
    scouts: scouts.map(staffFromDump),
    clubOf,
  }
}
