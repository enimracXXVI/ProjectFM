import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../data/config'
import type { PlayerRow } from '../data/db'
import { styleFits } from './assistant'
import {
  applyCodes,
  DEFAULT_GAME_IDEAS,
  ideaFit,
  ideaTeam,
  squadCheck,
  teamConflicts,
} from './ideas'
import {
  applyPlayers,
  applyTeam,
  buildAll,
  candidateShapes,
  ideaShapes,
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

  it('builds a game idea: its shapes, its roles where players suit them, pairings met', () => {
    const idea = DEFAULT_GAME_IDEAS.find((x) => x.id === 'counter')!
    const built = buildAll(ideaShapes(idea), { ...bctx, idea })
    expect(built.length).toBe(idea.shapes.length)
    for (const b of built) {
      expect(idea.shapes).toContain(b.shape.label)
      expect(b.ideaMatch).not.toBeNull()
      expect(b.unpaired).toEqual([])
    }
  })

  it('flags team instructions that do not fit together', () => {
    const defs = DEFAULT_CONFIG.teamInstructions
    const pd = defs.find((d) => d.name === 'Passing directness')!
    const tempo = defs.find((d) => d.name === 'Tempo')!
    const codes = [
      pd.options.find((o) => o.label === 'Much more direct passes')!.code,
      tempo.options.find((o) => o.label === 'Much lower')!.code,
    ]
    expect(teamConflicts(codes, defs).map((x) => x.id)).toContain('conflict-direct-tempo')
    expect(teamConflicts(codes, defs, { 'conflict-direct-tempo': false })).toHaveLength(0)
  })

  it("every idea's instructions exist in FM and do not conflict with each other", () => {
    const defs = DEFAULT_CONFIG.teamInstructions
    for (const idea of DEFAULT_GAME_IDEAS) {
      const items = ideaTeam(idea, defaultTeamCodes(defs), defs)
      expect(items.length, idea.id).toBe(idea.team.length)
      expect(teamConflicts(applyCodes(defaultTeamCodes(defs), items, defs), defs), idea.id).toEqual(
        [],
      )
      for (const name of idea.shapes) expect(FORMATIONS[name], name).toBeDefined()
      const ids = new Set(DEFAULT_CONFIG.roles.map((r) => r.id))
      for (const r of idea.roles)
        for (const id of [...r.ip, ...r.oop]) expect(ids.has(id), id).toBe(true)
      for (const x of [...idea.players, ...idea.avoid]) {
        const d = DEFAULT_CONFIG.playerInstructions.find((y) => y.name === x.instruction)
        expect(
          d?.options.some((o) => o.label === x.option),
          `${x.instruction} ${x.option}`,
        ).toBe(true)
      }
    }
  })

  it('checks the squad against an idea', () => {
    const idea = DEFAULT_GAME_IDEAS.find((x) => x.id === 'catenaccio')!
    const checks = squadCheck(idea, squad)
    expect(checks).toHaveLength(idea.needs.length)
    expect(ideaFit(checks)).toBeGreaterThan(0)
  })

  it('never runs an inside forward wide, and keeps out what the idea avoids', () => {
    const slots = [{ position: 'AML' as const, player: 'aml', role: 'if' }]
    const sq = [
      {
        ...squad.find((p) => p.id === 'aml')!,
        attributes: {
          ...squad.find((p) => p.id === 'aml')!.attributes,
          Dribbling: 18,
          Crossing: 18,
        },
      },
    ]
    const out = playerSuggestions(
      slots,
      sq,
      DEFAULT_CONFIG.roles,
      DEFAULT_CONFIG.fmCodes,
      DEFAULT_CONFIG.playerInstructions,
      {},
      () => ({ left: 3, right: 1 }),
    )
    expect(out.some((x) => x.to === 'Run wide with ball')).toBe(false)
  })
})
