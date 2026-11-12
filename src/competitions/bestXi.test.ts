import { describe, expect, it } from 'vitest'
import { seasonText, seasonYear } from '../data/seasons'
import { bestXi, playerTotals, slotPositions } from './bestXi'
import { mergeCompetitions } from './storage'
import type { CompetitionsFile, ReportPlayer } from './types'

const rp = (id: number, rating: number, start = true, on: number | null = null): ReportPlayer => ({
  id,
  name: `P${id}`,
  start,
  rating,
  goals: 0,
  assists: 0,
  on,
  off: null,
  shots: 0,
  onTarget: 0,
  xg: 0,
  passes: 0,
  passesDone: 0,
  tackles: 0,
  tacklesWon: 0,
  aerials: 0,
  headersWon: 0,
  yellow: 0,
  red: 0,
})

const fixture = (date: string, comp = 1) => ({
  stage: null,
  round: null,
  roundIndex: null,
  date,
  time: null,
  season: 2026,
  home: 10,
  homeName: 'Us',
  homeShort: 'Us',
  homeSlot: 0,
  away: 20 + comp,
  awayName: 'Them',
  awayShort: 'Them',
  awaySlot: 0,
  hg: 1,
  ag: 0,
  played: true,
  neutral: false,
  stadium: null,
  leg: null,
})

// Player 1: 30 matches at 7.2; player 2: 3 matches at 7.8 (the user's example); a friendly
// where player 2 scores 10 does not count
const dates = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
const file: CompetitionsFile = {
  version: 1,
  club: 10,
  clubName: 'Us',
  season: 2026,
  playerMatches: [],
  competitions: [
    { id: 1, databaseId: 32, onlyMine: false, stages: [], fixtures: dates.map((d) => fixture(d)) },
    {
      id: 2,
      databaseId: 104551,
      onlyMine: false,
      stages: [],
      fixtures: [fixture('2026-07-01', 2)],
    },
  ],
  squads: [
    ...dates.map((d, i) => ({
      date: d,
      home: 10,
      away: 21,
      homeSquad: [],
      awaySquad: [],
      homePlayers: [rp(1, 7.2), ...(i < 3 ? [rp(2, 7.8)] : [])],
      awayPlayers: [],
    })),
    {
      date: '2026-07-01',
      home: 10,
      away: 22,
      homeSquad: [],
      awaySquad: [],
      homePlayers: [rp(2, 10)],
      awayPlayers: [],
    },
  ],
}
const kindOf = (db: number | null) => (db === 32 ? 'league' : 'friendlies') as never

describe('Best XI', () => {
  it('weights rating by minutes: the regular beats the short burst', () => {
    const t = playerTotals([file], kindOf, 6)
    const one = t.find((p) => p.id === 1)!
    const two = t.find((p) => p.id === 2)!
    expect(one).toMatchObject({ matches: 30, rating: 7.2, score: 36 })
    expect(two).toMatchObject({ matches: 3, rating: 7.8, score: 5.4 })
  })

  it('places each player once, only where he can play', () => {
    const t = playerTotals([file], kindOf, 6)
    const xi = bestXi(['DR', 'DC'], t, (id) => (id === 1 ? 'D (RC)' : 'D (C)'))
    expect(xi.map((s) => s.player?.id)).toEqual([1, 2])
    expect(slotPositions('AML')).toEqual(['AM (L)'])
  })
})

describe('merging a season file', () => {
  it('keeps matches the newer save no longer holds', () => {
    const newer = { ...file, squads: file.squads!.slice(5) }
    const merged = mergeCompetitions(file, newer)
    expect(merged.squads).toHaveLength(file.squads!.length)
  })
})

describe('season labels', () => {
  it('reads and writes the season', () => {
    expect(seasonYear('2026/27')).toBe(2026)
    expect(seasonText(2026)).toBe('2026/27')
    expect(seasonYear(null)).toBeNull()
  })
})
