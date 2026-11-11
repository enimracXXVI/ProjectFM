import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/serie-a-md1.json'
import { leagueTable } from './league'
import type { Fixture } from './types'

describe('leagueTable', () => {
  it('matches FM’s Serie A table after matchday 1 (user’s save)', () => {
    const table = leagueTable(fixtures as Fixture[], { matchday: 1 })
    expect(table.map((r) => r.short)).toEqual([
      // As FM shows it (FM's own table in the save)
      'Fiorentina',
      'Roma',
      'Frosinone',
      'Cagliari',
      'Milan',
      'Inter',
      'Udinese',
      'Bologna',
      'Monza',
      'Lecce',
      'Napoli',
      'Juventus',
      'Torino',
      // Atalanta – Lazio was not played yet
      'Atalanta',
      'Lazio',
      'Como',
      'Parma',
      'Sassuolo',
      'Genoa',
      'Venezia',
    ])
    expect(table[0]).toMatchObject({ played: 1, won: 1, gf: 4, ga: 1, points: 3, form: ['W'] })
  })

  it('splits home and away', () => {
    const home = leagueTable(fixtures as Fixture[], { venue: 'home' })
    expect(home.find((r) => r.short === 'Venezia')!.played).toBe(0)
    expect(home.find((r) => r.short === 'Fiorentina')!.points).toBe(3)
  })
})
