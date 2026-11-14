/**
 * A tactic briefing: what the tactic asks for and who is asked to do it, from the tactic's
 * own data only (shape, roles, instructions, the preferred XI and the role-fit scores).
 * No match advice is invented: every line is something the app knows.
 */
import type { AppConfig } from '../data/config'
import type { PlayerRow } from '../data/db'
import { attrNumber } from '../lib/attributes'
import { shortName } from '../lib/names'
import { benchCover, slotScore, type FitContext } from './analysis'
import { chosen, fmPositions, playerChoices, posOf, roleIdOf, teamCodes } from './fm'
import { formationLabel } from './positions'
import type { TacticRow } from './types'

type Config = Pick<
  AppConfig,
  'roles' | 'roleWeights' | 'fmCodes' | 'teamInstructions' | 'playerInstructions'
>

export interface BriefingSlot {
  /** FM position in and out of possession (e.g. "DCL", "DMC → DCL"). */
  where: string
  roles: string
  player: string | null
  fit: number | null
  /** Player instructions set, and the ones the role always does. */
  instructions: string[]
  /** The player's three weakest key attributes for these roles, with values. */
  weakest: [string, number][]
  cover: string | null
}

export interface Briefing {
  title: string
  shape: string
  /** Team instructions not on their standard option, by phase. */
  team: { ip: string[]; oop: string[] }
  slots: BriefingSlot[]
  /** Points to watch: low fits, players out of position, positions without cover. */
  watch: string[]
}

const LOW_FIT = 55

export function buildBriefing(t: TacticRow, squad: PlayerRow[], config: Config): Briefing {
  const ctx: FitContext = { roles: config.roles, weights: config.roleWeights }
  const codes = teamCodes(t.instructions, config.teamInstructions)
  const changed = (phase: 'ip' | 'oop') =>
    config.teamInstructions
      .filter((d) => d.phase === phase)
      .flatMap((d) => {
        const o = chosen(d, codes)
        return o && o.code !== 0 && o.code !== d.default ? [`${d.name}: ${o.label}`] : []
      })
  const ip = fmPositions(t.slots, 'ip', config.fmCodes)
  const oop = fmPositions(t.slots, 'oop', config.fmCodes)
  const cover = benchCover(t.slots, squad, ctx)
  const watch: string[] = []

  const slots = t.slots.map((s, i): BriefingSlot => {
    const roleIp = config.roles.find((r) => r.id === roleIdOf(s, 'ip')) ?? null
    const roleOop = config.roles.find((r) => r.id === roleIdOf(s, 'oop')) ?? null
    const player = squad.find((p) => p.id === s.player) ?? null
    const fit = player ? slotScore(player, s, ctx) : null
    const a = ip[i]?.id ?? posOf(s, 'ip') ?? '?'
    const b = oop[i]?.id ?? posOf(s, 'oop') ?? '?'
    const instructions = (['ip', 'oop'] as const).flatMap((phase) => {
      const role = phase === 'ip' ? roleIp : roleOop
      const at = phase === 'ip' ? ip[i] : oop[i]
      const set = (phase === 'ip' ? s.pi : s.piOop) ?? []
      return config.playerInstructions
        .filter((d) => d.phase === phase)
        .flatMap((d) => {
          const { options, forced } = playerChoices(d, role, at)
          if (forced) return [`${d.name}: ${options[0].label} (role)`]
          const o = chosen(d, set)
          return o && o.code !== 0 ? [`${d.name}: ${o.label}`] : []
        })
    })
    const keys = [...new Set([...(roleIp?.key ?? []), ...(roleOop?.key ?? [])])]
    const weakest = player
      ? keys
          .map((k) => [k, attrNumber(player.attributes[k])] as [string, number | null])
          .filter((x): x is [string, number] => x[1] !== null)
          .sort((x, y) => x[1] - y[1])
          .slice(0, 3)
      : []
    const name = player ? shortName(player) : null
    if (!player) watch.push(`${a}: no player picked.`)
    else if (fit !== null && fit < LOW_FIT) watch.push(`${a}: ${name} fits the roles at ${fit}.`)
    if (!cover[i]) watch.push(`${a}: nobody else in the squad plays this position.`)
    return {
      where: a === b ? a : `${a} → ${b}`,
      roles: [roleIp?.name ?? 'No role', roleOop?.name ?? 'No role'].join(' / '),
      player: name,
      fit,
      instructions,
      weakest,
      cover: cover[i] ? `${shortName(cover[i]!.player)} (${cover[i]!.score})` : null,
    }
  })

  return {
    title: [t.name, t.mentality].filter(Boolean).join(' · '),
    shape: `${formationLabel(t.slots.map((s) => posOf(s, 'ip')))} in possession, ${formationLabel(t.slots.map((s) => posOf(s, 'oop')))} out of possession`,
    team: { ip: changed('ip'), oop: changed('oop') },
    slots,
    watch,
  }
}

/** The briefing as plain text, to copy into notes or a message. */
export function briefingText(b: Briefing): string {
  const lines = [b.title, b.shape, '']
  const list = (title: string, items: string[]) => {
    lines.push(title, ...(items.length ? items.map((x) => `- ${x}`) : ['- All standard']), '')
  }
  list('Team instructions in possession', b.team.ip)
  list('Team instructions out of possession', b.team.oop)
  lines.push('Positions')
  for (const s of b.slots) {
    lines.push(
      `- ${s.where} · ${s.roles} · ${s.player ?? 'no player'}${s.fit !== null ? ` (${s.fit})` : ''}`,
    )
    for (const x of s.instructions) lines.push(`    ${x}`)
    if (s.weakest.length)
      lines.push(`    Weakest key attributes: ${s.weakest.map(([k, v]) => `${k} ${v}`).join(', ')}`)
    lines.push(`    Cover: ${s.cover ?? 'none'}`)
  }
  if (b.watch.length) list('\nWatch', b.watch)
  return lines.join('\n').trim()
}
