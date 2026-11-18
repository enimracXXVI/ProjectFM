/**
 * Stat profiles: the figures that matter for a role or a position, scored as percentiles
 * against the players who play that position (with enough minutes). Editable in
 * Settings > Stat profiles.
 */
import { parsePositions } from '../lib/roleFit'
import { metricValue, type PlayerStats } from './stats'

export interface StatProfile {
  id: string
  name: string
  kind: 'role' | 'position'
  /** FM positions of the players compared ("D (C)", "AM (L)"…). */
  positions: string[]
  /** Figures (stats metric keys); `low` when a lower value is better. */
  metrics: { key: string; low?: boolean }[]
}

const m = (...keys: string[]) =>
  keys.map((k) => (k.startsWith('-') ? { key: k.slice(1), low: true } : { key: k }))

const GK = ['GK']
const CB = ['D (C)']
const FB = ['D (L)', 'D (R)']
const WB = ['WB (L)', 'WB (R)']
const DM = ['DM']
const MC = ['M (C)']
const ML = ['M (L)', 'M (R)']
const AMC = ['AM (C)']
const AML = ['AM (L)', 'AM (R)']
const ST = ['ST (C)']
const OUTFIELD = [...CB, ...FB, ...WB, ...DM, ...MC, ...ML, ...AMC, ...AML, ...ST]

const GK_M = m('expected_goals_prevented/90', 'save_pct', '-goals_allowed/90', 'clean_sheets/90')
const CB_M = m(
  'header_pct',
  'headers_won/90',
  'interceptions/90',
  'tackle_pct',
  'blocks/90',
  'clearances/90',
  '-mistakes_leading_to_goal/90',
)
const WB_M = m(
  'expected_assists/90',
  'key_passes/90',
  'crosses_completed/90',
  'progressive_passes/90',
  'dribbles/90',
  'tackles_completed/90',
  'interceptions/90',
)
const DM_M = m(
  'possession_won/90',
  'interceptions/90',
  'tackle_pct',
  'pressures_completed/90',
  'pass_pct',
  '-possession_lost/90',
)
const AM_M = m(
  'expected_assists/90',
  'key_passes/90',
  'clear_cut_chances_created/90',
  'non_penalty_expected_goals/90',
  'dribbles/90',
  'shots_on_target/90',
)
const WINGER_M = m(
  'expected_assists/90',
  'crosses_completed/90',
  'cross_pct',
  'dribbles/90',
  'key_passes/90',
  'progressive_passes/90',
)
const CF_M = m(
  'non_penalty_expected_goals/90',
  'goals/90',
  'xg_per_shot',
  'on_target_pct',
  'conversion_pct',
  'goals_minus_xg/90',
)

export const DEFAULT_STAT_PROFILES: StatProfile[] = [
  // Roles (Goalkeeper, Line-Holding and No-Nonsense Goalkeeper…)
  { id: 'gk', name: 'Goalkeeper', kind: 'role', positions: GK, metrics: GK_M },
  {
    id: 'gk-ball',
    name: 'Ball-Playing / Sweeper Keeper',
    kind: 'role',
    positions: GK,
    metrics: [...GK_M, ...m('pass_pct', 'progressive_passes/90')],
  },
  {
    id: 'cb',
    name: 'Centre-Back (Stopping, Covering, No-Nonsense, Wide)',
    kind: 'role',
    positions: CB,
    metrics: CB_M,
  },
  {
    id: 'cb-ball',
    name: 'Ball-Playing / Advanced / Overlapping Centre-Back',
    kind: 'role',
    positions: CB,
    metrics: [...CB_M, ...m('progressive_passes/90', 'pass_pct', 'dribbles/90')],
  },
  {
    id: 'fb',
    name: 'Full-Back (Holding, Pressing, Inside)',
    kind: 'role',
    positions: FB,
    metrics: m(
      'tackles_completed/90',
      'interceptions/90',
      'pressures_completed/90',
      'possession_won/90',
      'crosses_completed/90',
    ),
  },
  {
    id: 'wb',
    name: 'Wing-Back (Advanced, Playmaking, Inside)',
    kind: 'role',
    positions: [...WB, ...FB],
    metrics: WB_M,
  },
  {
    id: 'dm',
    name: 'Defensive Midfielder (Screening, Pressing, Dropping, Half Back)',
    kind: 'role',
    positions: DM,
    metrics: DM_M,
  },
  {
    id: 'playmaker',
    name: 'Deep-Lying / Midfield / Box-To-Box Playmaker',
    kind: 'role',
    positions: [...DM, ...MC],
    metrics: m(
      'progressive_passes/90',
      'key_passes/90',
      'expected_assists/90',
      'pass_pct',
      'passes_completed/90',
    ),
  },
  {
    id: 'cm',
    name: 'Box-To-Box / Central / Channel / Wide Central Midfielder',
    kind: 'role',
    positions: MC,
    metrics: m(
      'possession_won/90',
      'progressive_passes/90',
      'key_passes/90',
      'distance_km/90',
      'high_intensity_sprints/90',
      'non_penalty_expected_goals/90',
    ),
  },
  {
    id: 'am',
    name: 'Attacking Midfielder / Advanced Playmaker / Free Role',
    kind: 'role',
    positions: AMC,
    metrics: AM_M,
  },
  {
    id: 'winger',
    name: 'Winger / Wide Midfielder / Playmaking Winger',
    kind: 'role',
    positions: [...ML, ...AML],
    metrics: WINGER_M,
  },
  {
    id: 'inside',
    name: 'Inside Winger / Inside Forward / Wide Forward',
    kind: 'role',
    positions: AML,
    metrics: m(
      'non_penalty_expected_goals/90',
      'shots/90',
      'xg_per_shot',
      'dribbles/90',
      'expected_assists/90',
      'goals_minus_xg/90',
    ),
  },
  {
    id: 'cf',
    name: 'Centre Forward / Poacher / Channel Forward / Second Striker',
    kind: 'role',
    positions: ST,
    metrics: CF_M,
  },
  {
    id: 'tf',
    name: 'Target Forward',
    kind: 'role',
    positions: ST,
    metrics: [...CF_M, ...m('headers_won/90', 'header_pct', 'key_headers/90')],
  },
  {
    id: 'dlf',
    name: 'Deep-Lying Forward / False Nine',
    kind: 'role',
    positions: ST,
    metrics: m(
      'non_penalty_expected_goals/90',
      'expected_assists/90',
      'key_passes/90',
      'progressive_passes/90',
      'dribbles/90',
      'pass_pct',
    ),
  },
  {
    id: 'press',
    name: 'Pressing / Tracking (any outfield role)',
    kind: 'role',
    positions: OUTFIELD,
    metrics: m('pressures_completed/90', 'possession_won/90'),
  },
  // Positions
  {
    id: 'pos-gk',
    name: 'GK',
    kind: 'position',
    positions: GK,
    metrics: [...GK_M, ...m('pass_pct')],
  },
  {
    id: 'pos-dlr',
    name: 'D (L/R)',
    kind: 'position',
    positions: FB,
    metrics: m(
      'tackles_completed/90',
      'interceptions/90',
      'possession_won/90',
      'crosses_completed/90',
      'expected_assists/90',
      'progressive_passes/90',
    ),
  },
  {
    id: 'pos-dc',
    name: 'D (C)',
    kind: 'position',
    positions: CB,
    metrics: [...CB_M, ...m('progressive_passes/90', 'pass_pct')],
  },
  { id: 'pos-wb', name: 'WB (L/R)', kind: 'position', positions: WB, metrics: WB_M },
  {
    id: 'pos-dm',
    name: 'DM',
    kind: 'position',
    positions: DM,
    metrics: [...DM_M, ...m('progressive_passes/90')],
  },
  {
    id: 'pos-mc',
    name: 'M (C)',
    kind: 'position',
    positions: MC,
    metrics: m(
      'possession_won/90',
      'progressive_passes/90',
      'key_passes/90',
      'pass_pct',
      'expected_assists/90',
      'non_penalty_expected_goals/90',
    ),
  },
  { id: 'pos-mlr', name: 'M (L/R)', kind: 'position', positions: ML, metrics: WINGER_M },
  { id: 'pos-amc', name: 'AM (C)', kind: 'position', positions: AMC, metrics: AM_M },
  {
    id: 'pos-amlr',
    name: 'AM (L/R)',
    kind: 'position',
    positions: AML,
    metrics: m(
      'expected_assists/90',
      'dribbles/90',
      'key_passes/90',
      'non_penalty_expected_goals/90',
      'crosses_completed/90',
      'goals_minus_xg/90',
    ),
  },
  { id: 'pos-st', name: 'ST (C)', kind: 'position', positions: ST, metrics: CF_M },
]

/** True when the player can play one of the profile's positions. */
export const fitsProfile = (profile: StatProfile, positions: string | null) =>
  parsePositions(positions).some((p) => profile.positions.includes(p))

export interface ProfileScore {
  /** Average percentile of the figures (0–100). */
  score: number
  /** Each figure: its value and percentile among the compared players (null: no value). */
  parts: { key: string; value: number | null; pct: number | null }[]
}

/**
 * Percentile scores for a profile: every player who can play its positions and has at
 * least `minMinutes` is compared with the others; a figure where lower is better counts
 * the other way round. Players outside the pool get no score.
 */
export function profileScores(
  profile: StatProfile,
  players: { id: number; positions: string | null }[],
  stats: Map<number, PlayerStats>,
  minMinutes: number,
): Map<number, ProfileScore> {
  const pool = players.filter(
    (p) => fitsProfile(profile, p.positions) && (stats.get(p.id)?.minutes ?? 0) >= minMinutes,
  )
  const columns = profile.metrics.map((mt) => {
    const values = pool.map((p) => metricValue(stats.get(p.id), mt.key))
    const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b)
    return { mt, values, sorted }
  })
  // Share of the pool below a value (ties count half): binary search on the sorted list
  const pctOf = (sorted: number[], v: number) => {
    let lo = 0
    let hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid] < v) lo = mid + 1
      else hi = mid
    }
    let end = lo
    while (end < sorted.length && sorted[end] === v) end++
    return sorted.length ? ((lo + (end - lo) / 2) / sorted.length) * 100 : 50
  }
  const out = new Map<number, ProfileScore>()
  pool.forEach((p, i) => {
    const parts = columns.map(({ mt, values, sorted }) => {
      const v = values[i]
      if (v === null) return { key: mt.key, value: null, pct: null }
      const pct = pctOf(sorted, v)
      return { key: mt.key, value: v, pct: Math.round(mt.low ? 100 - pct : pct) }
    })
    const known = parts.filter((x) => x.pct !== null)
    if (!known.length) return
    out.set(p.id, {
      score: Math.round(known.reduce((sum, x) => sum + x.pct!, 0) / known.length),
      parts,
    })
  })
  return out
}

/** Minutes a player needs to be compared when no minimum is set. */
export const DEFAULT_PROFILE_MINUTES = 450
