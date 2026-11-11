import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import fixtures from './fixtures/serie-a-md1.json'
import { achievements, allGames, headToHead } from './records'
import type { CompetitionsFile, Fixture } from './types'

const file: CompetitionsFile = {
  version: 1,
  club: 1129,
  clubName: 'A.C.F. Fiorentina',
  season: 2026,
  competitions: [
    { id: 22, databaseId: 32, onlyMine: false, stages: [], fixtures: fixtures as Fixture[] },
  ],
  playerMatches: [],
}

describe('records', () => {
  it('shows the league position while the season is in progress', () => {
    expect(achievements([file], DEFAULT_CONFIG)).toEqual([
      expect.objectContaining({
        competition: 'Serie A',
        result: '1st (in progress)',
        trophy: false,
      }),
    ])
  })

  it('counts the record against an opponent', () => {
    const { record } = headToHead(allGames([file], DEFAULT_CONFIG), 1179) // Venezia
    expect(record).toEqual({ played: 1, won: 1, drawn: 0, lost: 0, gf: 4, ga: 1 })
  })
})
