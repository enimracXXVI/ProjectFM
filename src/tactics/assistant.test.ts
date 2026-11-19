import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import type { PlayerRow } from '../data/db'
import { styleFits } from './assistant'
import {
  applyPlayers,
  applyTeam,
  buildAll,
  candidateShapes,
  playerSuggestions,
  PLAYER_RULES,
  TEAM_RULES,
  teamSuggestions,
} from './builder'
import { defaultTeamCodes } from './fm'
import { FORMATIONS } from './positions'

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
const bctx = {
  squad,
  roles: DEFAULT_CONFIG.roles,
  weights: DEFAULT_CONFIG.roleWeights,
  codes: DEFAULT_CONFIG.fmCodes,
  warnings: DEFAULT_CONFIG.roleWarnings,
  style: null,
}

describe('tactic assistant', () => {
  it('ranks every FM style with favoured attributes', () => {
    const fits = styleFits(DEFAULT_CONFIG.tacticalStyles, squad)
    expect(fits.length).toBe(DEFAULT_CONFIG.tacticalStyles.filter((s) => s.favoured.length).length)
    expect(fits.every((f) => f.score !== null)).toBe(true)
  })

  it('builds every shape around the squad, best first, with roles FM offers', () => {
    const shapes = candidateShapes(
      DEFAULT_CONFIG.tacticalStyles,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
    )
    expect(shapes.length).toBeGreaterThan(Object.keys(FORMATIONS).length)
    const built = buildAll(shapes, bctx)
    expect(built.length).toBeGreaterThan(0)
    const best = built[0]
    expect(best.slots.filter((s) => s.player).length).toBe(11)
    expect(best.slots.every((s) => s.role && s.roleOop)).toBe(true)
    expect(best.rank).toBeGreaterThanOrEqual(built[built.length - 1].rank)
    expect(new Set(best.slots.map((s) => s.player)).size).toBe(11)
  })

  it('puts must-play players in the XI', () => {
    const shapes = candidateShapes(
      DEFAULT_CONFIG.tacticalStyles,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
    )
    const built = buildAll(shapes, { ...bctx, mustPlay: new Set(['st2']) })
    expect(built[0].slots.some((s) => s.player === 'st2')).toBe(true)
  })

  it('sets the line from the centre-backs, and the rule can be switched off', () => {
    const defs = DEFAULT_CONFIG.teamInstructions
    const slots = [
      { position: 'DC' as const, player: 'dc1' },
      { position: 'DC' as const, player: 'dc2' },
    ]
    const base = defaultTeamCodes(defs)
    const out = teamSuggestions(slots, squad, base, defs, {})
    const a = out.find((x) => x.instruction === 'Defensive line height')!
    expect(a.to).toBe('Much lower')
    expect(applyTeam(base, [a], defs)).toContain(a.code)
    expect(
      teamSuggestions(slots, squad, base, defs, { 'line-height': false }).some(
        (x) => x.instruction === 'Defensive line height',
      ),
    ).toBe(false)
    expect([...TEAM_RULES, ...PLAYER_RULES].every((r) => r.about.length > 20)).toBe(true)
  })

  it('suggests player instructions only where FM offers them for the role', () => {
    const shapes = candidateShapes(
      DEFAULT_CONFIG.tacticalStyles,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
    )
    const slots = buildAll(shapes, bctx)[0].slots
    const out = playerSuggestions(
      slots,
      squad,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
      DEFAULT_CONFIG.playerInstructions,
      {},
      () => ({ left: null, right: null }),
    )
    const applied = applyPlayers(slots, out, DEFAULT_CONFIG.playerInstructions)
    for (const s of out) {
      const slot = applied[s.slot]
      expect((s.phase === 'ip' ? slot.pi : slot.piOop) ?? []).toContain(s.code)
    }
  })
})
