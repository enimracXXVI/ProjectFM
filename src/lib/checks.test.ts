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

describe('unnamed traits', () => {
  it('asks for trait numbers the app cannot name, with the player to look at', async () => {
    const { findChecks } = await import('./checks')
    const { DEFAULT_CONFIG } = await import('../data/config')
    const p = (name: string, Traits: string) =>
      ({ name, in_squad: true, extra: { Traits }, attributes: {} }) as never
    const c = findChecks([p('Pote', '2,8,57'), p('Inao', '57,60')], [], undefined, DEFAULT_CONFIG)
    expect(c.traits.map((t) => t.bit)).toEqual([57, 60])
    // Pote has only one unnamed trait, so he comes first
    expect(c.traits[0].players[0].name).toBe('Pote')
    expect(c.traits[0].players[0].order).toEqual([
      'Runs With Ball Through Centre',
      'Shoots From Distance',
      'this',
    ])
  })
})
