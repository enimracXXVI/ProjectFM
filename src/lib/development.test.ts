import { describe, expect, it } from 'vitest'
import { computeDevelopment, type DevSnapshot } from './development'

const snap = (player: string, day: number, attributes: DevSnapshot['attributes']): DevSnapshot => ({
  player_id: player,
  created_at: `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`,
  season: '2026/27',
  attributes,
})

describe('computeDevelopment', () => {
  const data = [
    snap('a', 1, { Pace: 10, Flair: 12 }),
    snap('a', 2, { Pace: 11, Flair: 12 }),
    snap('a', 3, { Pace: 13, Flair: 11, Vision: 9 }),
    snap('b', 1, { Pace: 15 }),
    snap('b', 3, { Pace: 14 }),
    snap('c', 3, { Pace: 8 }),
    snap('d', 2, {}),
  ]

  it('ranks players by total gain over all imports', () => {
    const rows = computeDevelopment(data, null)
    expect(rows.map((r) => r.playerId)).toEqual(['a', 'b'])
    expect(rows[0]).toMatchObject({ gain: 2, improved: 1, declined: 1, imports: 3 })
    expect(rows[0].changes).toEqual([
      { name: 'Pace', diff: 3 },
      { name: 'Flair', diff: -1 },
    ])
  })

  it('ignores attributes missing at the start and builds a trend line', () => {
    const a = computeDevelopment(data, null)[0]
    expect(a.changes.find((c) => c.name === 'Vision')).toBeUndefined()
    expect(a.trend).toEqual([22, 23, 24])
  })

  it('limits the comparison to the last N imports', () => {
    const a = computeDevelopment(data, 2).find((r) => r.playerId === 'a')!
    expect(a.gain).toBe(1)
    expect(a.imports).toBe(2)
  })

  it('skips players with fewer than two imports', () => {
    expect(computeDevelopment(data, null).some((r) => r.playerId === 'c')).toBe(false)
  })
})
