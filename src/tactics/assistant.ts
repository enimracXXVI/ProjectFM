/**
 * Tactic assistant: builds a tactic for the squad step by step.
 *
 * What it rests on, kept apart:
 * - FM27's own data: the tactical styles (favoured attributes, preferred roles, instructions)
 *   and FM's 9 template tactics per style (shape, roles in and out of possession, player and
 *   team instructions), read from the game's match data.
 * - The squad from the save: role fit and the positions each player can play.
 * - Rules of thumb (general tactical knowledge, not FM27 data): each says why, and can be
 *   switched off in Settings > Tactic assistant.
 */
import type { PlayerRow } from '../data/db'
import { attrNumber } from '../lib/attributes'
import { bestXi, gradeTactic, type FitContext } from './analysis'
import { choose, chosen, type FmCodes, type FmInstruction } from './fm'
import { POSITION_TEXT } from './positions'
import type { TacticalStyle } from './styles'
import { FM_TEMPLATES, templateTactic, type FmTemplate } from './templates'
import type { PositionCode, TacticSlot } from './types'
import type { RoleDef } from '../data/roles'

/** FM's "Set Piece Ability" is no single attribute: the set piece attributes stand in. */
const SET_PIECES = ['Corners', 'Free Kick Taking', 'Long Throws', 'Penalty Taking']

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const attr = (p: PlayerRow, name: string) =>
  name === 'Set Piece Ability'
    ? avg(SET_PIECES.map((a) => attrNumber(p.attributes[a])))
    : attrNumber(p.attributes[name])

/** First-team players the assistant picks from. */
export const firstTeam = (squad: PlayerRow[]) => squad.filter((p) => p.in_squad && !p.extra.team)

/**
 * How well the squad suits each style: the squad's average in the attributes FM says the
 * style favours (best 16 players for each attribute, so a few weak reserves do not count).
 */
export function styleFits(styles: TacticalStyle[], squad: PlayerRow[]) {
  return styles
    .filter((s) => s.favoured.length)
    .map((s) => {
      const per = s.favoured.map((a) => {
        const top = squad
          .map((p) => attr(p, a))
          .filter((x): x is number => x !== null)
          .sort((x, y) => y - x)
          .slice(0, 16)
        return { attribute: a, value: avg(top) }
      })
      return { style: s, score: avg(per.map((x) => x.value)), per }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

export interface ShapeOption {
  template: FmTemplate
  name: string
  mentality: string | null
  styleText: string | null
  slots: TacticSlot[]
  team: number[]
  /** Average role fit of the best XI (0–100). */
  grade: number | null
  /** Players picked out of their positions (nobody else could play there). */
  outOfPosition: number
}

/** FM's template tactics for a style, each filled with the squad's best XI and graded. */
export function shapeOptions(
  style: TacticalStyle,
  styles: TacticalStyle[],
  squad: PlayerRow[],
  roles: RoleDef[],
  codes: FmCodes,
  ctx: FitContext,
): ShapeOption[] {
  return FM_TEMPLATES.filter((t) => t.style === style.code)
    .map((template) => {
      const t = templateTactic(template, styles, roles, codes)
      const xi = bestXi(t.slots, squad, ctx, new Set())
      const slots = t.slots.map((s, i) => ({ ...s, player: xi[i] }))
      const g = gradeTactic(slots, squad, ctx)
      return {
        template,
        name: t.name,
        mentality: t.mentality,
        styleText: t.style,
        slots,
        team: t.team,
        grade: g.team,
        outOfPosition: g.fits.filter((f) => f.outOfPosition).length,
      }
    })
    .sort((a, b) => a.outOfPosition - b.outOfPosition || (b.grade ?? 0) - (a.grade ?? 0))
}

export interface Adjustment {
  rule: string
  instruction: string
  from: string
  to: string
  why: string
  /** The team instruction codes with this change. */
  apply: (codes: number[]) => number[]
}

/** A rule of thumb for team instructions, from the XI's attributes. */
export interface TeamRule {
  id: string
  name: string
  /** Shown in Settings: what the rule does and why. */
  about: string
  check: (ctx: RuleContext) => { instruction: string; to: string; why: string } | null
}

interface RuleContext {
  xi: { p: PlayerRow; pos: PositionCode | null }[]
  current: (instruction: string) => string | null
}

const group = (ctx: RuleContext, positions: PositionCode[]) =>
  ctx.xi.filter((x) => x.pos && positions.includes(x.pos)).map((x) => x.p)
const groupAvg = (players: PlayerRow[], names: string[]) =>
  avg(players.flatMap((p) => names.map((n) => attr(p, n))))
const round = (x: number) => Math.round(x * 10) / 10
const CB: PositionCode[] = ['DC']
const BACK: PositionCode[] = ['DL', 'DC', 'DR', 'WBL', 'WBR']
const FRONT: PositionCode[] = ['AML', 'AMC', 'AMR', 'ST']
const OUTFIELD: PositionCode[] = [...BACK, 'DM', 'ML', 'MC', 'MR', ...FRONT]
const HIGH_LINE = ['Higher', 'Much higher']

export const TEAM_RULES: TeamRule[] = [
  {
    id: 'slow-line',
    name: 'Slow centre-backs: no high line',
    about:
      'Centre-backs averaging under 12 in Pace and Acceleration are easily run in behind a high line, so the line drops to Standard (Lower under 10).',
    check: (c) => {
      const v = groupAvg(group(c, CB), ['Pace', 'Acceleration'])
      const now = c.current('Defensive line height')
      if (v === null || v >= 12 || !now || !HIGH_LINE.includes(now)) return null
      return {
        instruction: 'Defensive line height',
        to: v < 10 ? 'Lower' : 'Standard',
        why: `Centre-backs average ${round(v)} in Pace and Acceleration.`,
      }
    },
  },
  {
    id: 'pace-up-front',
    name: 'Quick forwards: passes into space',
    about:
      'Attackers averaging 15+ in Pace and Acceleration are most dangerous running onto passes into space.',
    check: (c) => {
      const v = groupAvg(group(c, FRONT), ['Pace', 'Acceleration'])
      if (v === null || v < 15 || c.current('Pass reception') !== 'Balanced') return null
      return {
        instruction: 'Pass reception',
        to: 'Pass into space',
        why: `Attackers average ${round(v)} in Pace and Acceleration.`,
      }
    },
  },
  {
    id: 'dribblers',
    name: 'Good dribblers: encourage dribbling',
    about: 'Attackers averaging 15+ in Dribbling and Flair are worth letting run with the ball.',
    check: (c) => {
      const v = groupAvg(group(c, FRONT), ['Dribbling', 'Flair'])
      if (v === null || v < 15 || c.current('Dribbling') !== 'Balanced') return null
      return {
        instruction: 'Dribbling',
        to: 'Encourage',
        why: `Attackers average ${round(v)} in Dribbling and Flair.`,
      }
    },
  },
  {
    id: 'long-shots',
    name: 'Long-range shooters: encourage shots from distance',
    about: 'Two or more attackers or midfielders with 15+ Long Shots make shots from distance pay.',
    check: (c) => {
      const n = group(c, ['MC', 'AMC', 'AML', 'AMR', 'ST', 'DM']).filter(
        (p) => (attr(p, 'Long Shots') ?? 0) >= 15,
      ).length
      if (n < 2 || c.current('Shots from distance') !== 'Balanced') return null
      return {
        instruction: 'Shots from distance',
        to: 'Encourage',
        why: `${n} players in the XI have Long Shots 15 or more.`,
      }
    },
  },
  {
    id: 'aerial-forward',
    name: 'Strong in the air up front: floated crosses',
    about:
      'A striker with 15+ Heading and Jumping Reach wins high balls: floated crosses aim for him; a small striker (under 10) wants low crosses.',
    check: (c) => {
      const st = group(c, ['ST'])
      if (!st.length || c.current('Crossing style') !== 'Balanced') return null
      const best = Math.max(
        ...st.map((p) => Math.min(attr(p, 'Heading') ?? 0, attr(p, 'Jumping Reach') ?? 0)),
      )
      if (best >= 15)
        return {
          instruction: 'Crossing style',
          to: 'Floated crosses',
          why: `A striker has ${best}+ in both Heading and Jumping Reach.`,
        }
      const air = Math.max(...st.map((p) => attr(p, 'Heading') ?? 0))
      if (air < 10)
        return {
          instruction: 'Crossing style',
          to: 'Low crosses',
          why: `The strikers' best Heading is ${air}.`,
        }
      return null
    },
  },
  {
    id: 'press-fitness',
    name: 'Unfit or lazy team: press less',
    about:
      'Pressing more often needs running: outfield players averaging under 12 in Work Rate and Stamina tire and leave gaps, so the trigger press comes down one step.',
    check: (c) => {
      const v = groupAvg(group(c, OUTFIELD), ['Work Rate', 'Stamina'])
      const now = c.current('Trigger press')
      if (v === null || v >= 12 || (now !== 'More often' && now !== 'Much more often')) return null
      return {
        instruction: 'Trigger press',
        to: now === 'Much more often' ? 'More often' : 'Standard',
        why: `Outfield players average ${round(v)} in Work Rate and Stamina.`,
      }
    },
  },
  {
    id: 'build-up',
    name: 'Defenders weak on the ball: do not play through the press',
    about:
      'Playing through the press needs defenders comfortable on the ball: under 11 in Passing, Composure and First Touch, the build-up goes to Balanced.',
    check: (c) => {
      const v = groupAvg(group(c, BACK), ['Passing', 'Composure', 'First Touch'])
      if (v === null || v >= 11 || c.current('Build-up strategy') !== 'Play through the press')
        return null
      return {
        instruction: 'Build-up strategy',
        to: 'Balanced',
        why: `Defenders average ${round(v)} in Passing, Composure and First Touch.`,
      }
    },
  },
]

/** The rules of thumb that change the team instructions for this XI. */
export function adjustments(
  slots: TacticSlot[],
  squad: PlayerRow[],
  codes: number[],
  defs: FmInstruction[],
  enabled: Record<string, boolean>,
): Adjustment[] {
  const def = (name: string) => defs.find((d) => d.name === name)
  const ctx: RuleContext = {
    xi: slots.flatMap((s) => {
      const p = squad.find((x) => x.id === s.player)
      return p ? [{ p, pos: s.position }] : []
    }),
    current: (name) => {
      const d = def(name)
      return d ? (chosen(d, codes)?.label ?? null) : null
    },
  }
  return TEAM_RULES.filter((r) => enabled[r.id] !== false).flatMap((r) => {
    const hit = r.check(ctx)
    const d = hit && def(hit.instruction)
    const option = d?.options.find((o) => o.label === hit!.to)
    if (!hit || !d || !option) return []
    return [
      {
        rule: r.name,
        instruction: hit.instruction,
        from: ctx.current(hit.instruction) ?? '?',
        to: hit.to,
        why: hit.why,
        apply: (c: number[]) => choose(d, c, option.code),
      },
    ]
  })
}

/** Position text of a slot, for display. */
export const slotPosition = (s: TacticSlot) => (s.position ? POSITION_TEXT[s.position] : '?')
