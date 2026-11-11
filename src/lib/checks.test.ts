import { describe, expect, it } from 'vitest'
import type { PlayerRow, StaffRow } from '../data/db'
import { findChecks } from './checks'
import { applyLearned } from './learned'

const player = (name: string, extra: Record<string, string>, personality: string | null = null) =>
  ({ id: name, name, in_squad: true, personality, extra, attributes: {} }) as unknown as PlayerRow

describe('Check in game', () => {
  it('lists unknown words by value and personalities that fit no rule', () => {
    const c = findChecks(
      [
        player('A', { Morale: 'Unknown (12)', Ambition: '10' }),
        player('B', { Morale: 'Unknown (12)', Ambition: '10' }, 'Balanced'),
        player('C', { Morale: 'Good (13)' }),
      ],
      [
        {
          name: 'Scout',
          knowledge: [
            { nation: 'Italy', level: 'Unknown (42)' },
            { nation: 'Spain', level: 'Complete (100)' },
          ],
        } as unknown as StaffRow,
      ],
    )
    expect(c.morale).toEqual([{ value: 12, where: ['A', 'B'] }])
    expect(c.knowledge).toEqual([{ value: 42, where: ['Scout – Italy'] }])
    expect(c.personality.map((p) => p.name)).toEqual(['A'])
    expect(c.total).toBe(3)
  })

  it('uses a word the user taught', () => {
    expect(applyLearned('Unknown (12)', { 12: 'Okay' })).toBe('Okay (12)')
    expect(applyLearned('Unknown (11)', { 12: 'Okay' })).toBe('Unknown (11)')
    expect(applyLearned('Good (13)', { 13: 'X' })).toBe('Good (13)')
  })
})
