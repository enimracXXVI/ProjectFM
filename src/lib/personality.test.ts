import { describe, expect, it } from 'vitest'
import squad from './fixtures/personality-squad.json'
import { personalityName } from './personality'

describe('personalityName', () => {
  it('matches FM for every player in the user squad export', () => {
    for (const p of squad) expect(personalityName(p.values), p.name).toBe(p.expected)
  })
})

describe('personalityName for staff (no Leadership)', () => {
  it('matches FM for the scouts checked', () => {
    // Personality values and Determination (shown 1–20) from the user's save
    const scouts: [string, Record<string, number>, string][] = [
      [
        'Davide Doné',
        {
          professionalism: 12,
          pressure: 11,
          ambition: 11,
          temperament: 7,
          loyalty: 11,
          sportsmanship: 10,
          determination: 13,
        },
        'Balanced',
      ],
      [
        'Lorenzo Giani',
        {
          professionalism: 12,
          pressure: 12,
          ambition: 11,
          temperament: 20,
          loyalty: 10,
          sportsmanship: 9,
          determination: 12,
        },
        'Balanced',
      ],
      [
        'Peter Braund',
        {
          professionalism: 13,
          pressure: 12,
          ambition: 14,
          temperament: 13,
          loyalty: 16,
          sportsmanship: 10,
          determination: 15,
        },
        'Fairly Determined',
      ],
      [
        'Ramón Vázquez',
        {
          professionalism: 12,
          pressure: 11,
          ambition: 12,
          temperament: 17,
          loyalty: 13,
          sportsmanship: 8,
          determination: 18,
        },
        'Driven',
      ],
      [
        'Tomás Amaral',
        {
          professionalism: 9,
          pressure: 13,
          ambition: 9,
          temperament: 14,
          loyalty: 14,
          sportsmanship: 10,
          determination: 12,
        },
        'Balanced',
      ],
      [
        'Sebastian Arenz',
        {
          professionalism: 17,
          pressure: 10,
          ambition: 15,
          temperament: 16,
          loyalty: 10,
          sportsmanship: 12,
          determination: 16,
        },
        'Resolute',
      ],
    ]
    for (const [name, v, expected] of scouts) expect(personalityName(v), name).toBe(expected)
  })
})
