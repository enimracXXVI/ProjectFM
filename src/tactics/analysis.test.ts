import { describe, expect, it } from 'vitest'
import type { PlayerRow } from '../data/db'
import { DEFAULT_ROLES } from '../data/roles'
import { DEFAULT_ROLE_WEIGHTS } from '../lib/roleFit'
import { assign, benchCover, bestXi, gradeTactic, playsPosition, suggestions } from './analysis'
import type { TacticSlot } from './types'

const ctx = { roles: DEFAULT_ROLES, weights: DEFAULT_ROLE_WEIGHTS }
const all = (v: number) =>
  Object.fromEntries(
    [...new Set(DEFAULT_ROLES.flatMap((r) => [...r.key, ...r.preferred]))].map((a) => [a, v]),
  )
const player = (id: string, positions: string, level: number): PlayerRow =>
  ({ id, name: id, positions, attributes: all(level), extra: {}, in_squad: true }) as never

const gkRole = DEFAULT_ROLES.find((r) => r.positions.includes('GK') && r.phase === 'ip')!
const stRole = DEFAULT_ROLES.find((r) => r.positions.includes('ST (C)') && r.phase === 'ip')!
const slots: TacticSlot[] = [
  { position: 'GK', role: gkRole.id, player: null },
  { position: 'ST', role: stRole.id, player: null },
]

describe('tactic analysis', () => {
  it('assigns at the lowest total cost', () => {
    expect(
      assign([
        [4, 1, 3],
        [2, 0, 5],
      ]),
    ).toEqual([1, 0])
  })

  it('knows who can play a position', () => {
    expect(playsPosition(player('a', 'D (RC), DM', 10), 'DC')).toBe(true)
    expect(playsPosition(player('a', 'D (RC), DM', 10), 'ST')).toBe(false)
    expect(playsPosition(player('a', 'ST', 10), 'ST')).toBe(true)
  })

  it('picks the best XI, each player in a position he can play, locks kept', () => {
    const squad = [
      player('keeper', 'GK', 12),
      player('star', 'ST (C)', 18),
      player('sub', 'ST (C)', 10),
    ]
    expect(bestXi(slots, squad, ctx, new Set())).toEqual(['keeper', 'star'])
    const locked = [{ ...slots[0] }, { ...slots[1], player: 'sub' }]
    expect(bestXi(locked, squad, ctx, new Set([1]))).toEqual(['keeper', 'sub'])
  })

  it('grades, suggests a better player and finds bench cover', () => {
    const squad = [
      player('keeper', 'GK', 12),
      player('star', 'ST (C)', 18),
      player('sub', 'ST (C)', 10),
    ]
    const xi = [
      { ...slots[0], player: 'keeper' },
      { ...slots[1], player: 'sub' },
    ]
    const { fits, team } = gradeTactic(xi, squad, ctx)
    expect(fits[1].score).toBeLessThan(fits[0].score!)
    expect(team).not.toBeNull()
    expect(suggestions(xi, squad, ctx).some((s) => s.kind === 'player' && s.value === 'star')).toBe(
      true,
    )
    expect(benchCover(xi, squad, ctx)[1]?.player.id).toBe('star')
  })
})
