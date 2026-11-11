import { describe, expect, it } from 'vitest'
import raw from './fixtures/venezia-stats.json'
import { matchStats } from './matchStats'
import type { RawTeamStats } from './types'

describe('matchStats', () => {
  it('matches FM’s match stats screen for Fiorentina 4-1 Venezia', () => {
    const rows = matchStats(raw.homeStats as RawTeamStats, raw.awayStats as RawTeamStats)
    const by = Object.fromEntries(rows.map((r) => [r.label, [r.home, r.away]]))
    expect(by).toEqual({
      xG: [2.546, 1.052],
      'Shots on target': [10, 4],
      'Long shots': [5, 4],
      Possession: [55, 45],
      'Passes completed': [554, 451],
      'Final third passes': [111, 94],
      'Tackles won': [4, 7],
      'Headers won': [11, 7],
      Offsides: [6, 6],
    })
    const text = Object.fromEntries(rows.map((r) => [r.label, [r.homeText, r.awayText]]))
    expect(text['Headers won']).toEqual(['57% · 11/19', '36% · 7/19'])
    expect(text['Tackles won']).toEqual(['100% · 4/4', '87% · 7/8'])
    expect(text['Passes completed']).toEqual(['90% · 554/614', '89% · 451/504'])
  })
})
