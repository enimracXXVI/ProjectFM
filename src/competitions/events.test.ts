import { describe, expect, it } from 'vitest'
import { averageRating, teamMatchStats } from './matchStats'
import type { Fixture, TeamStats } from './types'
import { halfTime, pensWinner, scoreText } from './view'

// Fiorentina 4-1 Venezia and Cremonese 1-1 Sampdoria (6-5 pens) as the reader returns them
const venezia = {
  played: true,
  home: 1129,
  away: 1179,
  hg: 4,
  ag: 1,
  events: [
    [1, 0, 6, 0, 'Akor Adams', 'Ridgeciano Haps'],
    [0, 0, 32, 0, 'Franco Mastantuono', 'Mateo Pellegrino'],
    [0, 0, 37, 0, 'Mateo Pellegrino', 'Cher Ndour'],
    [0, 0, 42, 0, 'Cher Ndour', 'Franco Mastantuono'],
    [0, 0, 85, 0, 'Beto', 'Franco Mastantuono'],
  ],
} as unknown as Fixture
const cremonese = {
  played: true,
  home: 1125,
  away: 1167,
  hg: 1,
  ag: 1,
  pens: [6, 5],
  events: [
    [1, 0, 3, 0, 'Tobias Lauritsen', 'Liam Henderson'],
    [0, 0, 81, 0, 'David Stückler', 'Alberto Grassi'],
    [0, 4, 90, 6, 'Tommaso Berti', null],
    [1, 5, 90, 6, 'Antoine Makoumbou', null],
  ],
} as unknown as Fixture

describe('match events', () => {
  it('works out the half-time score from the goal minutes', () => {
    expect(halfTime(venezia)).toEqual([3, 1])
    expect(halfTime(cremonese)).toEqual([0, 1])
  })
  it('shows penalties', () => {
    expect(scoreText(cremonese)).toBe('1 – 1 p')
    expect(pensWinner(cremonese)).toBe(1125)
    expect(pensWinner(venezia)).toBeNull()
  })
  it('needs a full XI of ratings for an average', () => {
    expect(averageRating([7, 7, 7])).toBeNull()
    expect(averageRating(Array(11).fill(6.5).concat([7.6]))).toBe(6.59)
  })
})

describe('teamMatchStats', () => {
  const base = {
    shots: 16,
    shots_on_target: 10,
    blocked_shots: 1,
    shots_outside_box: 5,
    clear_cut_chances: 3,
    woodwork: 0,
    fouls_made: 8,
    offsides: 6,
    yellow_cards: 2,
    red_cards: 0,
    crosses_attempted: 43,
    crosses_completed: 7,
    tackles_attempted: 4,
    tackles_completed: 4,
    aerial_challenges_attempted: 19,
    headers_won: 11,
    distance_km: 124.6,
    expected_goals: 2.546,
    non_penalty_expected_goals: 2.546,
    corners: 7,
    passes_attempted: 614,
    passes_completed: 554,
    final_third_passes: 111,
    progressive_passes: 59,
    possession_percent: 55,
    ball_distribution_percent: 53,
  } satisfies TeamStats
  it('rounds percentages down like FM', () => {
    const { key, advanced } = teamMatchStats(base, base, [6.98, 6.5])
    expect(key.find((r) => r.label === 'Headers won')?.homeText).toBe('57% · 11/19')
    expect(advanced.find((r) => r.label === 'Crosses completed')?.homeText).toBe('16% · 7/43')
    expect(key.find((r) => r.label.startsWith('Distance'))?.home).toBe(125)
    expect(advanced[0]).toMatchObject({ label: 'Average rating', home: 6.98 })
  })
})
