import { describe, expect, it } from 'vitest'
import ravenna from './fixtures/ravenna-stats.json'
import venezia from './fixtures/venezia-stats.json'
import { matchStats } from './matchStats'
import type { RawTeamStats } from './types'

const table = (raw: { homeStats: unknown; awayStats: unknown }) =>
  Object.fromEntries(
    matchStats(raw.homeStats as RawTeamStats, raw.awayStats as RawTeamStats).map((r) => [
      r.label,
      r.homeText ? [r.homeText, r.awayText] : [r.home, r.away],
    ]),
  )

describe('matchStats (FM’s match stats screens)', () => {
  it('Fiorentina 4-1 Venezia', () => {
    expect(table(venezia)).toEqual({
      Shots: [16, 7],
      xG: [2.546, 1.052],
      'Clear-cut chances': [3, 1],
      Corners: [7, 4],
      'Headers won': ['57% · 11/19', '36% · 7/19'],
      'Tackles won': ['100% · 4/4', '87% · 7/8'],
      Fouls: [8, 8],
      'Yellow cards': [2, 0],
      Possession: [55, 45],
      'Shots blocked': [1, 3],
      'Passes completed': ['90% · 554/614', '89% · 451/504'],
      'Final third passes': [111, 94],
      Offsides: [6, 6],
    })
  })

  it('Fiorentina 3-0 Ravenna', () => {
    expect(table(ravenna)).toEqual({
      Shots: [17, 11],
      xG: [1.645, 1.155],
      'Clear-cut chances': [1, 0],
      Corners: [8, 3],
      'Headers won': ['54% · 13/24', '43% · 10/23'],
      'Tackles won': ['85% · 6/7', '66% · 6/9'],
      Fouls: [5, 11],
      'Yellow cards': [3, 4],
      Possession: [61, 39],
      'Shots blocked': [7, 3],
      'Passes completed': ['89% · 516/577', '84% · 334/393'],
      'Final third passes': [115, 37],
      Offsides: [1, 1],
    })
  })
})
