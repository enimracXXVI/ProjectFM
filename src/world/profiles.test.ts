import { describe, expect, it } from 'vitest'
import { METRICS } from './stats'
import { DEFAULT_STAT_PROFILES, profileScores, type StatProfile } from './profiles'

describe('stat profiles', () => {
  it('only uses figures the app knows', () => {
    const keys = new Set(METRICS.map((m) => m.key))
    for (const p of DEFAULT_STAT_PROFILES)
      for (const mt of p.metrics) expect(keys.has(mt.key), `${p.id}: ${mt.key}`).toBe(true)
  })

  it('scores percentiles within the position, lower-is-better turned round', () => {
    const profile: StatProfile = {
      id: 't',
      name: 'Test',
      kind: 'position',
      positions: ['ST (C)'],
      metrics: [{ key: 'goals/90' }, { key: 'possession_lost/90', low: true }],
    }
    const players = [
      { id: 1, positions: 'ST (C)' },
      { id: 2, positions: 'ST (C)' },
      { id: 3, positions: 'D (C)' },
      { id: 4, positions: 'ST (C)' },
    ]
    const stats = new Map([
      [1, { minutes: 900, goals: 10, possession_lost: 10 }],
      [2, { minutes: 900, goals: 2, possession_lost: 50 }],
      [3, { minutes: 900, goals: 0, possession_lost: 0 }],
      [4, { minutes: 90, goals: 5, possession_lost: 0 }],
    ])
    const out = profileScores(profile, players, stats, 450)
    expect([...out.keys()].sort()).toEqual([1, 2]) // centre-back and short minutes left out
    expect(out.get(1)!.score).toBe(75)
    expect(out.get(2)!.score).toBe(25)
  })
})
