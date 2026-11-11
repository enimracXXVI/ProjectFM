/**
 * Team match stats from the raw blocks of FM's match report. Each position below was
 * matched to FM's match stats screen for Fiorentina 4-1 Venezia (both teams' numbers had to
 * agree), and passes also equal the players' own totals in every first-team game.
 * Possession is completed passes as a share of both teams' completed passes, which gives
 * FM's 55% – 45% for that game.
 */
import type { RawTeamStats } from './types'

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
  const possHome = pct(home.h[1], home.h[1] + away.h[1])
  const ratio = (r: RawTeamStats, done: number, att: number) =>
    `${pct(r.h[done], r.h[att])}% · ${r.h[done]}/${r.h[att]}`
  return [
    { label: 'xG', home: home.xg, away: away.xg, format: 'dec' },
    { label: 'Shots on target', home: home.u[15], away: away.u[15] },
    { label: 'Long shots', home: home.u[11], away: away.u[11] },
    { label: 'Possession', home: possHome, away: 100 - possHome, format: 'pct' },
    {
      label: 'Passes completed',
      home: home.h[1],
      away: away.h[1],
      homeText: ratio(home, 1, 0),
      awayText: ratio(away, 1, 0),
    },
    { label: 'Final third passes', home: home.h104[4], away: away.h104[4] },
    {
      label: 'Tackles won',
      home: home.h[4],
      away: away.h[4],
      homeText: ratio(home, 4, 3),
      awayText: ratio(away, 4, 3),
    },
    {
      label: 'Headers won',
      home: home.h[6],
      away: away.h[6],
      homeText: ratio(home, 6, 5),
      awayText: ratio(away, 6, 5),
    },
    { label: 'Offsides', home: home.b[21], away: away.b[21] },
  ]
}
