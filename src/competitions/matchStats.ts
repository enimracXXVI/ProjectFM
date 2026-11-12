/**
 * Team match stats from the raw blocks of FM's match report. Each position below was
 * matched to FM's match stats screen for two games, Fiorentina 4-1 Venezia and Fiorentina
 * 3-0 Ravenna (all four teams' numbers had to agree); passes also equal the players' own
 * totals in every first-team game. Possession is completed passes as a share of both
 * teams' completed passes (FM: 55–45 and 61–39).
 */
import type { RawTeamStats, TeamStats } from './types'

export interface StatRow {
  label: string
  home: number
  away: number
  /** Shown next to the number, e.g. "554/614". */
  homeText?: string
  awayText?: string
  format?: 'pct' | 'dec'
}

// FM rounds percentages down (11/19 shows as 57%, 7/8 as 87%)
const pct = (a: number, b: number) => (b > 0 ? Math.floor((a / b) * 100) : 0)

export function matchStats(home: RawTeamStats, away: RawTeamStats): StatRow[] {
  // Possession is rounded to the nearest whole number (60.7% shows as 61%)
  const done = home.h[1] + away.h[1]
  const possHome = done > 0 ? Math.round((home.h[1] / done) * 100) : 50
  const ratio = (r: RawTeamStats, won: number, att: number) =>
    `${pct(r.h[won], r.h[att])}% · ${r.h[won]}/${r.h[att]}`
  const shots = (r: RawTeamStats) => r.b[0] + r.b[1]
  return [
    { label: 'Shots', home: shots(home), away: shots(away) },
    { label: 'xG', home: home.xg, away: away.xg, format: 'dec' },
    { label: 'Clear-cut chances', home: home.b[5], away: away.b[5] },
    { label: 'Corners', home: home.b[17], away: away.b[17] },
    {
      label: 'Headers won',
      home: home.h[6],
      away: away.h[6],
      homeText: ratio(home, 6, 5),
      awayText: ratio(away, 6, 5),
    },
    {
      label: 'Tackles won',
      home: home.h[4],
      away: away.h[4],
      homeText: ratio(home, 4, 3),
      awayText: ratio(away, 4, 3),
    },
    { label: 'Fouls', home: home.b[20], away: away.b[20] },
    { label: 'Yellow cards', home: home.b[22], away: away.b[22] },
    { label: 'Possession', home: possHome, away: 100 - possHome, format: 'pct' },
    { label: 'Shots blocked', home: home.b[4], away: away.b[4] },
    {
      label: 'Passes completed',
      home: home.h[1],
      away: away.h[1],
      homeText: ratio(home, 1, 0),
      awayText: ratio(away, 1, 0),
    },
    { label: 'Final third passes', home: home.h104[4], away: away.h104[4] },
    { label: 'Offsides', home: home.b[21], away: away.b[21] },
  ]
}

/** FM's two tabs of match stats, from the named stats (reader 11 and later). */
export function teamMatchStats(
  home: TeamStats,
  away: TeamStats,
  rating?: [number | null, number | null],
): { key: StatRow[]; advanced: StatRow[] } {
  const ratio = (won: number, att: number) => `${pct(won, att)}% · ${won}/${att}`
  const row = (label: string, k: keyof TeamStats, format?: StatRow['format']): StatRow => ({
    label,
    home: Number(home[k] ?? 0),
    away: Number(away[k] ?? 0),
    format,
  })
  const pair = (label: string, won: keyof TeamStats, att: keyof TeamStats): StatRow => ({
    label,
    home: Number(home[won]),
    away: Number(away[won]),
    homeText: ratio(Number(home[won]), Number(home[att])),
    awayText: ratio(Number(away[won]), Number(away[att])),
  })
  const key: StatRow[] = [
    row('Shots', 'shots'),
    row('Shots on target', 'shots_on_target'),
    row('xG', 'expected_goals', 'dec'),
    row('Clear-cut chances', 'clear_cut_chances'),
    row('Corners', 'corners'),
    pair('Headers won', 'headers_won', 'aerial_challenges_attempted'),
    pair('Tackles won', 'tackles_completed', 'tackles_attempted'),
    row('Fouls', 'fouls_made'),
    row('Yellow cards', 'yellow_cards'),
    row('Red cards', 'red_cards'),
    row('Possession', 'possession_percent', 'pct'),
    {
      label: 'Distance covered (km)',
      home: Math.round(home.distance_km),
      away: Math.round(away.distance_km),
    },
  ]
  const advanced: StatRow[] = [
    ...(rating && rating[0] !== null && rating[1] !== null
      ? [{ label: 'Average rating', home: rating[0], away: rating[1], format: 'dec' as const }]
      : []),
    row('NpXG', 'non_penalty_expected_goals', 'dec'),
    row('Long shots', 'shots_outside_box'),
    row('Woodwork', 'woodwork'),
    row('Shots blocked', 'blocked_shots'),
    pair('Passes completed', 'passes_completed', 'passes_attempted'),
    row('Final third passes', 'final_third_passes'),
    ...(home.progressive_passes !== null && away.progressive_passes !== null
      ? [row('Progressive passes', 'progressive_passes')]
      : []),
    row('Ball share', 'ball_distribution_percent'),
    pair('Crosses completed', 'crosses_completed', 'crosses_attempted'),
    row('Offsides', 'offsides'),
  ]
  return { key, advanced }
}

/** FM's average rating: the mean of the match ratings of everyone who played. */
export function averageRating(ratings: (number | null)[]): number | null {
  const r = ratings.filter((x): x is number => x !== null)
  // FM keeps ratings only for some players: no average unless at least a full XI is rated
  return r.length >= 11 ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 100) / 100 : null
}
