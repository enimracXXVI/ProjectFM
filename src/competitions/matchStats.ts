/**
 * Team match stats from the raw blocks of FM's match report. Each position below was
 * matched to FM's match stats screen for two games, Fiorentina 4-1 Venezia and Fiorentina
 * 3-0 Ravenna (all four teams' numbers had to agree); passes also equal the players' own
 * totals in every first-team game. Possession is completed passes as a share of both
 * teams' completed passes (FM: 55–45 and 61–39).
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
