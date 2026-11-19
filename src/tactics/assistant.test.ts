import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import type { PlayerRow } from '../data/db'
import { adjustments, shapeOptions, styleFits, TEAM_RULES } from './assistant'
import { choose } from './fm'

const ATTRS = Object.keys(DEFAULT_CONFIG.attributes)
const player = (id: string, positions: string, v: number, extra: Record<string, number> = {}) =>
  ({
    id,
    name: `Player ${id}`,
    positions,
    in_squad: true,
    extra: {},
    attributes: { ...Object.fromEntries(ATTRS.map((a) => [a, v])), ...extra },
  }) as unknown as PlayerRow

const squad = [
  player('gk', 'GK', 14),
  player('dr', 'D/WB (R)', 13),
  player('dl', 'D/WB (L)', 13),
  player('dc1', 'D (C)', 14, { Pace: 8, Acceleration: 8 }),
  player('dc2', 'D (C)', 14, { Pace: 9, Acceleration: 9 }),
  player('dc3', 'D (C)', 12),
  player('dm', 'DM', 14),
  player('mc1', 'M (C)', 14),
  player('mc2', 'M (C)', 13),
  player('aml', 'AM (L)', 15),
  player('amr', 'AM (R)', 15),
  player('amc', 'AM (C)', 14),
  player('st', 'ST (C)', 15),
  player('st2', 'ST (C)', 12),
]
const ctx = { roles: DEFAULT_CONFIG.roles, weights: DEFAULT_CONFIG.roleWeights }

describe('tactic assistant', () => {
  it('ranks every FM style with favoured attributes', () => {
    const fits = styleFits(DEFAULT_CONFIG.tacticalStyles, squad)
    expect(fits.length).toBe(DEFAULT_CONFIG.tacticalStyles.filter((s) => s.favoured.length).length)
    expect(fits.every((f) => f.score !== null)).toBe(true)
  })

  it("fills FM's nine templates of a style with the best XI", () => {
    const style = DEFAULT_CONFIG.tacticalStyles.find((s) => s.code === 'GEGE')!
    const out = shapeOptions(
      style,
      DEFAULT_CONFIG.tacticalStyles,
      squad,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
      ctx,
    )
    expect(out.length).toBe(9)
    expect(out[0].slots.filter((s) => s.player).length).toBe(11)
    expect(out[0].outOfPosition).toBeLessThanOrEqual(out[out.length - 1].outOfPosition)
  })

  it('drops a high line for slow centre-backs, and the rule can be switched off', () => {
    const defs = DEFAULT_CONFIG.teamInstructions
    const line = defs.find((d) => d.name === 'Defensive line height')!
    const high = line.options.find((o) => o.label === 'Much higher')!.code
    const codes = choose(line, [], high)
    const slots = [
      { position: 'DC' as const, player: 'dc1' },
      { position: 'DC' as const, player: 'dc2' },
    ]
    const out = adjustments(slots, squad, codes, defs, {})
    const a = out.find((x) => x.instruction === 'Defensive line height')!
    expect(a.to).toBe('Lower')
    expect(a.apply(codes)).not.toContain(high)
    expect(adjustments(slots, squad, codes, defs, { 'slow-line': false })).toHaveLength(0)
    expect(TEAM_RULES.every((r) => r.about.length > 20)).toBe(true)
  })
})
