/**
 * How complex FM finds a tactic: the points FM's match data gives each team instruction
 * option, each role and each player instruction (generated_tactical_complexity_constants in
 * simatch.fmf). FM caps the team's instructions at 49 points and each player at 9. FM's own
 * badge (Average / High complexity) also weighs players and the opponent in a way the file
 * does not spell out, so these are FM's points, not FM's badge.
 */
import type { RoleDef } from '../data/roles'
import { COMPLEXITY_MAX, roleIdOf, type FmInstruction } from './fm'
import type { TacticSlot } from './types'

export interface ComplexityItem {
  label: string
  points: number
}

export interface PlayerComplexity {
  slot: number
  points: number
  items: ComplexityItem[]
}

export function tacticComplexity(
  slots: TacticSlot[],
  team: number[],
  config: {
    roles: RoleDef[]
    teamInstructions: FmInstruction[]
    playerInstructions: FmInstruction[]
  },
) {
  const teamItems: ComplexityItem[] = config.teamInstructions.flatMap((d) =>
    d.options
      .filter((o) => o.code !== 0 && team.includes(o.code) && (o.complexity ?? 0) > 0)
      .map((o) => ({ label: `${d.name}: ${o.label}`, points: o.complexity ?? 0 })),
  )
  const teamPoints = Math.min(
    COMPLEXITY_MAX.teamMax,
    teamItems.reduce((n, x) => n + x.points, 0),
  )
  const players: PlayerComplexity[] = slots.map((s, slot) => {
    const items: ComplexityItem[] = []
    for (const phase of ['ip', 'oop'] as const) {
      const role = config.roles.find((r) => r.id === roleIdOf(s, phase))
      if (role?.fm?.complexity) items.push({ label: role.name, points: role.fm.complexity })
      const pi = phase === 'ip' ? s.pi : s.piOop
      for (const d of config.playerInstructions.filter((x) => x.phase === phase))
        for (const o of d.options)
          if (o.code !== 0 && pi?.includes(o.code) && (o.complexity ?? 0) > 0)
            items.push({ label: `${d.name}: ${o.label}`, points: o.complexity ?? 0 })
    }
    const points = Math.min(
      COMPLEXITY_MAX.playerMax,
      items.reduce((n, x) => n + x.points, 0),
    )
    return { slot, points, items }
  })
  const playerAverage = players.length
    ? players.reduce((n, p) => n + p.points, 0) / players.length
    : 0
  return {
    team: { points: teamPoints, max: COMPLEXITY_MAX.teamMax, items: teamItems },
    players,
    playerAverage,
    playerMax: COMPLEXITY_MAX.playerMax,
  }
}
