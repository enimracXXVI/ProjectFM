/**
 * Every player's season stats, as the save import stores them (one file per season, replaced
 * at each import, so a season's file ends up holding the whole season). Per-90 figures and
 * percentages are worked out here from the totals.
 */

export interface SeasonStatsFile {
  /** Competition kinds, by index: overall, league, cup, continental. */
  kinds: string[]
  /** Stat names, in the order of each row's values. */
  fields: string[]
  /** [player Unique ID, kind index, ...values]. */
  rows: number[][]
}

export type StatKind = 'overall' | 'league' | 'cup' | 'continental'
export const STAT_KINDS: [StatKind, string][] = [
  ['overall', 'All competitions'],
  ['league', 'League'],
  ['cup', 'Cups'],
  ['continental', 'Continental'],
]

export type PlayerStats = Record<string, number>

/** Each player's stats for one competition kind, by Unique ID. */
export function statsIndex(file: SeasonStatsFile, kind: StatKind): Map<number, PlayerStats> {
  const k = file.kinds.indexOf(kind)
  const out = new Map<number, PlayerStats>()
  if (k < 0) return out
  for (const r of file.rows) {
    if (r[1] !== k) continue
    const s: PlayerStats = {}
    file.fields.forEach((f, i) => (s[f] = r[i + 2]))
    out.set(r[0], s)
  }
  return out
}

/** The save's totals: name and box. Counts also get a per-90 figure. */
export const STAT_INFO: Record<string, { label: string; group: string; per90?: boolean }> = {
  starts: { label: 'Starts', group: 'General' },
  substitute_appearances: { label: 'Sub appearances', group: 'General' },
  minutes: { label: 'Minutes', group: 'General' },
  rated_appearances: { label: 'Rated appearances', group: 'General' },
  average_rating: { label: 'Average rating', group: 'General' },
  player_of_the_match: { label: 'Player of the Match', group: 'General' },
  goals: { label: 'Goals', group: 'Shooting', per90: true },
  expected_goals: { label: 'xG', group: 'Shooting', per90: true },
  non_penalty_expected_goals: { label: 'Non-penalty xG', group: 'Shooting', per90: true },
  shots: { label: 'Shots', group: 'Shooting', per90: true },
  shots_on_target: { label: 'Shots on target', group: 'Shooting', per90: true },
  shots_outside_box: { label: 'Shots from outside the box', group: 'Shooting', per90: true },
  goals_outside_box: { label: 'Goals from outside the box', group: 'Shooting', per90: true },
  free_kick_shots: { label: 'Free kick shots', group: 'Shooting', per90: true },
  penalties_taken: { label: 'Penalties taken', group: 'Shooting' },
  penalties_scored: { label: 'Penalties scored', group: 'Shooting' },
  assists: { label: 'Assists', group: 'Creating', per90: true },
  expected_assists: { label: 'xA', group: 'Creating', per90: true },
  key_passes: { label: 'Key passes', group: 'Creating', per90: true },
  open_play_key_passes: { label: 'Open play key passes', group: 'Creating', per90: true },
  clear_cut_chances_created: { label: 'Clear-cut chances created', group: 'Creating', per90: true },
  passes_attempted: { label: 'Passes attempted', group: 'Passing', per90: true },
  passes_completed: { label: 'Passes completed', group: 'Passing', per90: true },
  progressive_passes: { label: 'Progressive passes', group: 'Passing', per90: true },
  crosses_attempted: { label: 'Crosses attempted', group: 'Passing', per90: true },
  crosses_completed: { label: 'Crosses completed', group: 'Passing', per90: true },
  open_play_crosses_attempted: {
    label: 'Open play crosses attempted',
    group: 'Passing',
    per90: true,
  },
  open_play_crosses_completed: {
    label: 'Open play crosses completed',
    group: 'Passing',
    per90: true,
  },
  dribbles: { label: 'Dribbles', group: 'Ball carrying', per90: true },
  possession_lost: { label: 'Possession lost', group: 'Ball carrying', per90: true },
  offsides: { label: 'Offsides', group: 'Ball carrying', per90: true },
  fouls_against: { label: 'Fouls won', group: 'Ball carrying', per90: true },
  tackles_attempted: { label: 'Tackles attempted', group: 'Defending', per90: true },
  tackles_completed: { label: 'Tackles won', group: 'Defending', per90: true },
  key_tackles: { label: 'Key tackles', group: 'Defending', per90: true },
  interceptions: { label: 'Interceptions', group: 'Defending', per90: true },
  possession_won: { label: 'Possession won', group: 'Defending', per90: true },
  pressures_attempted: { label: 'Pressures attempted', group: 'Defending', per90: true },
  pressures_completed: { label: 'Pressures completed', group: 'Defending', per90: true },
  blocks: { label: 'Blocks', group: 'Defending', per90: true },
  shots_blocked: { label: 'Shots blocked', group: 'Defending', per90: true },
  clearances: { label: 'Clearances', group: 'Defending', per90: true },
  mistakes_leading_to_goal: { label: 'Mistakes leading to goal', group: 'Defending' },
  aerial_challenges_attempted: { label: 'Aerial challenges', group: 'Aerial', per90: true },
  headers_won: { label: 'Headers won', group: 'Aerial', per90: true },
  key_headers: { label: 'Key headers', group: 'Aerial', per90: true },
  distance_km: { label: 'Distance (km)', group: 'Physical', per90: true },
  high_intensity_sprints: { label: 'High intensity sprints', group: 'Physical', per90: true },
  fouls_made: { label: 'Fouls made', group: 'Discipline', per90: true },
  yellow_cards: { label: 'Yellow cards', group: 'Discipline' },
  red_cards: { label: 'Red cards', group: 'Discipline' },
  clean_sheets: { label: 'Clean sheets', group: 'Goalkeeping' },
  goals_allowed: { label: 'Goals conceded', group: 'Goalkeeping', per90: true },
  shots_on_target_faced: { label: 'Shots on target faced', group: 'Goalkeeping', per90: true },
  saves_held: { label: 'Saves held', group: 'Goalkeeping', per90: true },
  saves_parried: { label: 'Saves parried', group: 'Goalkeeping', per90: true },
  saves_tipped: { label: 'Saves tipped', group: 'Goalkeeping', per90: true },
  expected_goals_prevented: { label: 'xG prevented', group: 'Goalkeeping', per90: true },
}

/** Shares worked out from two totals: [label, box, part, whole]. */
const RATIOS: Record<string, [string, string, string, string]> = {
  pass_pct: ['Pass completion %', 'Passing', 'passes_completed', 'passes_attempted'],
  cross_pct: ['Cross completion %', 'Passing', 'crosses_completed', 'crosses_attempted'],
  on_target_pct: ['Shots on target %', 'Shooting', 'shots_on_target', 'shots'],
  conversion_pct: ['Conversion %', 'Shooting', 'goals', 'shots'],
  tackle_pct: ['Tackles won %', 'Defending', 'tackles_completed', 'tackles_attempted'],
  pressure_pct: [
    'Pressures completed %',
    'Defending',
    'pressures_completed',
    'pressures_attempted',
  ],
  header_pct: ['Headers won %', 'Aerial', 'headers_won', 'aerial_challenges_attempted'],
}
const XG_PER_SHOT = 'xg_per_shot'

export const STAT_GROUPS = [
  'General',
  'Shooting',
  'Creating',
  'Passing',
  'Ball carrying',
  'Defending',
  'Aerial',
  'Physical',
  'Discipline',
  'Goalkeeping',
]

export interface Metric {
  key: string
  label: string
  group: string
}

/** Every figure the app can show or sort by: totals, per 90 and shares. */
export const METRICS: Metric[] = [
  ...Object.entries(STAT_INFO).flatMap(([key, s]) => [
    { key, label: s.label, group: s.group },
    ...(s.per90 ? [{ key: `${key}/90`, label: `${s.label} per 90`, group: s.group }] : []),
  ]),
  ...Object.entries(RATIOS).map(([key, [label, group]]) => ({ key, label, group })),
  { key: XG_PER_SHOT, label: 'xG per shot', group: 'Shooting' },
].sort((a, b) => STAT_GROUPS.indexOf(a.group) - STAT_GROUPS.indexOf(b.group))

/** A figure for a player: a total, "<total>/90", or a share. Null when it cannot be worked out. */
export function metricValue(s: PlayerStats | undefined, key: string): number | null {
  if (!s) return null
  if (key.endsWith('/90')) {
    const v = s[key.slice(0, -3)]
    return v === undefined || !s.minutes ? null : (v / s.minutes) * 90
  }
  if (key === XG_PER_SHOT) return s.shots ? s.expected_goals / s.shots : null
  const r = RATIOS[key]
  if (r) return s[r[3]] ? (s[r[2]] / s[r[3]]) * 100 : null
  return s[key] ?? null
}

/** A figure as text: whole numbers as they are, others to 2 decimals, shares with %. */
export function formatMetric(key: string, v: number | null): string {
  if (v === null) return '–'
  if (key in RATIOS) return `${Math.round(v)}%`
  if (key.endsWith('/90')) return v.toFixed(2)
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}
