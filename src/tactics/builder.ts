/**
 * Tactic builder: builds tactics around the squad instead of picking one of FM's templates.
 *
 * 1. Shapes: every common formation and every shape FM27's template tactics use (in and out
 *    of possession), each filled with the squad.
 * 2. For each shape, the XI and roles that give the best role fit: each player gets the role
 *    he scores best in at his position (roles FM offers there, FM27 data), then roles are
 *    changed where FM would warn about the combination (FM27's role warnings), losing as
 *    little fit as possible.
 * 3. Team and player instructions from the players' attributes. These are rules of thumb
 *    (general tactical knowledge, not FM27 data): each says why and can be switched off in
 *    Settings > Tactic assistant. Player instructions are only set where FM offers them for
 *    the role at that position (FM27 data).
 */
import type { PlayerRow } from '../data/db'
import type { RoleDef } from '../data/roles'
import { attrNumber } from '../lib/attributes'
import { roleScore, type RoleWeights } from '../lib/roleFit'
import { assign, playsPosition } from './analysis'
import {
  choose,
  chosen,
  fmPositions,
  playerChoices,
  rolesAt,
  shapeOf,
  type FmCodes,
  type FmInstruction,
} from './fm'
import { FORMATIONS, POSITION_TEXT, formationLabel } from './positions'
import { matchRoles, type TacticalStyle } from './styles'
import { FM_TEMPLATES, templateTactic } from './templates'
import type { PositionCode, TacticSlot } from './types'
import { roleWarnings, type RoleWarning } from './warnings'

export interface BuildContext {
  squad: PlayerRow[]
  roles: RoleDef[]
  weights: RoleWeights
  codes: FmCodes
  warnings: RoleWarning[]
  /** Optional style: its preferred roles get a small bonus. */
  style: TacticalStyle | null
  /** Players who must be in the XI. */
  mustPlay?: Set<string>
}

/* ------------------------------------------------------------------ shapes */

export interface ShapeCandidate {
  key: string
  label: string
  /** Where the shape comes from. */
  from: string
  slots: TacticSlot[]
}

const shapeKey = (slots: TacticSlot[]) =>
  slots
    .map((s) => `${s.position}>${s.positionOop ?? s.position}`)
    .sort()
    .join(',')

/** Common formations and every shape FM's template tactics use, without repeats. */
export function candidateShapes(
  styles: TacticalStyle[],
  roles: RoleDef[],
  codes: FmCodes,
): ShapeCandidate[] {
  const out = new Map<string, ShapeCandidate>()
  for (const [name, list] of Object.entries(FORMATIONS)) {
    const slots = list.map((position) => ({ position, positionOop: position }))
    out.set(shapeKey(slots), { key: shapeKey(slots), label: name, from: 'Formation', slots })
  }
  for (const t of FM_TEMPLATES) {
    const read = templateTactic(t, styles, roles, codes)
    if (read.slots.length !== 11 || read.slots.some((s) => !s.position)) continue
    const slots: TacticSlot[] = read.slots.map((s) => ({
      position: s.position,
      positionOop: s.positionOop ?? s.position,
      side: s.side ?? null,
      sideOop: s.sideOop ?? null,
    }))
    const key = shapeKey(slots)
    if (out.has(key)) continue
    const ip = formationLabel(slots.map((s) => s.position))
    const oop = formationLabel(slots.map((s) => s.positionOop ?? s.position))
    out.set(key, {
      key,
      label: ip === oop ? ip : `${ip} / ${oop} out of possession`,
      from: 'Shape used by an FM27 template',
      slots,
    })
  }
  return [...out.values()]
}

/* ------------------------------------------------------------------ build */

export interface SlotPick {
  player: PlayerRow | null
  /** Role fit of the player in the slot (average of both phases). */
  score: number | null
  outOfPosition: boolean
}

export interface BuiltTactic {
  shape: ShapeCandidate
  slots: TacticSlot[]
  picks: SlotPick[]
  /** Average role fit of the XI. */
  fit: number
  /** Average fit of the best player left on the bench for each position. */
  depth: number
  outOfPosition: number
  /** Ranking value: fit, depth, out of position. */
  rank: number
  /** FM's warnings left (none could be removed without a big loss). */
  warnings: string[]
  /** Role changes made to avoid FM warnings. */
  changes: string[]
  /** The squad's best players (by their best role) who are not in this XI. */
  leftOut: { player: PlayerRow; score: number }[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Cached role scores for the whole squad. */
export function scoreTable(ctx: BuildContext) {
  const cache = new Map<string, number | null>()
  return (p: PlayerRow, r: RoleDef) => {
    const k = `${p.id}|${r.id}`
    if (!cache.has(k)) cache.set(k, roleScore(p.attributes, r, ctx.weights))
    return cache.get(k) ?? null
  }
}
type Scorer = ReturnType<typeof scoreTable>

function preferredIds(ctx: BuildContext) {
  return new Set(
    ctx.style
      ? matchRoles(ctx.style, ctx.roles)
          .flatMap((m) => m.roles)
          .map((r) => r.id)
      : [],
  )
}

/** Roles FM offers at each slot in each phase. */
function slotRoles(slots: TacticSlot[], ctx: BuildContext) {
  const text = (p: PositionCode) => POSITION_TEXT[p]
  const fmIp = fmPositions(slots, 'ip', ctx.codes)
  const fmOop = fmPositions(slots, 'oop', ctx.codes)
  const shIp = shapeOf(slots, 'ip')
  const shOop = shapeOf(slots, 'oop')
  return slots.map((_, i) => ({
    ip: rolesAt(ctx.roles, 'ip', fmIp[i], shIp, text),
    oop: rolesAt(ctx.roles, 'oop', fmOop[i], shOop, text),
  }))
}

const BONUS = 3

/** Roles ranked for a player: score, plus a small bonus for the style's preferred roles. */
function ranked(p: PlayerRow, list: RoleDef[], score: Scorer, preferred: Set<string>) {
  return list
    .map((r) => ({ r, s: score(p, r), v: (score(p, r) ?? 0) + (preferred.has(r.id) ? BONUS : 0) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.v - a.v)
}

/** Fill a shape with the squad: XI, roles, then fewer FM warnings. */
export function buildShape(
  shape: ShapeCandidate,
  ctx: BuildContext,
  score: Scorer,
  fixWarnings = true,
): BuiltTactic {
  const preferred = preferredIds(ctx)
  const options = slotRoles(shape.slots, ctx)
  const squad = ctx.squad
  const value = (p: PlayerRow, i: number) => {
    const a = ranked(p, options[i].ip, score, preferred)[0]
    const b = ranked(p, options[i].oop, score, preferred)[0]
    const v = [a?.s, b?.s].filter((x): x is number => x != null)
    return v.length ? avg(v) : 0
  }
  const values = squad.map((p) => shape.slots.map((_, i) => value(p, i)))
  const plays = squad.map((p) => shape.slots.map((s) => playsPosition(p, s.position)))
  const playsOop = squad.map((p) =>
    shape.slots.map((s) => playsPosition(p, s.positionOop ?? s.position)),
  )

  // Slots x players: in position first; must-play players before anyone else
  const cost = shape.slots.map((_, i) =>
    squad.map((p, j) => {
      let c = plays[j][i] ? -values[j][i] : 1000 - values[j][i]
      if (!playsOop[j][i]) c += 5
      if (ctx.mustPlay?.has(p.id)) c -= 3000
      return c
    }),
  )
  const width = Math.max(squad.length, shape.slots.length)
  const chosenCols = assign(
    cost.map((row) => [...row, ...new Array(width - row.length).fill(9000)]),
  )
  const xi = chosenCols.map((j) => (j >= 0 && j < squad.length ? squad[j] : null))

  // Best roles for each player
  let slots: TacticSlot[] = shape.slots.map((s, i) => {
    const p = xi[i]
    return {
      ...s,
      player: p?.id ?? null,
      role: p ? (ranked(p, options[i].ip, score, preferred)[0]?.r.id ?? null) : null,
      roleOop: p ? (ranked(p, options[i].oop, score, preferred)[0]?.r.id ?? null) : null,
    }
  })

  // Fewer FM warnings: the role change that removes most warnings for the least fit
  const changes: string[] = []
  const count = (ss: TacticSlot[]) => roleWarnings(ss, ctx.roles, ctx.warnings, ctx.codes).length
  const roleName = (id: string | null | undefined) =>
    ctx.roles.find((r) => r.id === id)?.name ?? id ?? '–'
  let warn = fixWarnings ? count(slots) : 0
  for (let step = 0; warn > 0 && step < 12; step++) {
    let best: { slots: TacticSlot[]; warn: number; loss: number; text: string } | null = null
    slots.forEach((s, i) => {
      const p = xi[i]
      if (!p) return
      for (const phase of ['ip', 'oop'] as const) {
        const list = ranked(p, phase === 'ip' ? options[i].ip : options[i].oop, score, preferred)
        const current = list.find((x) => x.r.id === (phase === 'ip' ? s.role : s.roleOop))
        for (const alt of list.slice(0, 8)) {
          if (alt.r.id === current?.r.id) continue
          const loss = (current?.s ?? 0) - (alt.s ?? 0)
          if (loss > 12) continue
          const trial = slots.map((x, j) =>
            j === i ? { ...x, [phase === 'ip' ? 'role' : 'roleOop']: alt.r.id } : x,
          )
          const w = count(trial)
          if (w >= warn) continue
          const better = !best || w < best.warn || (w === best.warn && loss < best.loss)
          if (better)
            best = {
              slots: trial,
              warn: w,
              loss,
              text: `${p.name}: ${roleName(current?.r.id)} → ${alt.r.name} (FM would warn about the combination)`,
            }
        }
      }
    })
    if (!best) break
    const b: { slots: TacticSlot[]; warn: number; text: string } = best
    slots = b.slots
    warn = b.warn
    changes.push(b.text)
  }

  const picks: SlotPick[] = slots.map((s, i) => {
    const p = xi[i]
    if (!p) return { player: null, score: null, outOfPosition: false }
    const r = [s.role, s.roleOop]
      .map((id) => ctx.roles.find((x) => x.id === id))
      .filter((x): x is RoleDef => !!x)
      .map((x) => score(p, x))
      .filter((x): x is number => x !== null)
    return {
      player: p,
      score: r.length ? Math.round(avg(r)) : null,
      outOfPosition: !playsPosition(p, s.position),
    }
  })
  const fit = Math.round(avg(picks.filter((x) => x.score !== null).map((x) => x.score!)))
  const inXi = new Set(xi.filter(Boolean).map((p) => p!.id))
  const depth = Math.round(
    avg(
      shape.slots.map((_, i) =>
        Math.max(
          0,
          ...squad.flatMap((p, j) => (!inXi.has(p.id) && plays[j][i] ? [values[j][i]] : [])),
        ),
      ),
    ),
  )
  const outOfPosition = picks.filter((x) => x.outOfPosition).length
  const leftOut = bestPlayers(ctx, score)
    .filter((x) => !inXi.has(x.player.id))
    .slice(0, 3)
  return {
    shape,
    slots,
    picks,
    fit,
    depth,
    outOfPosition,
    rank: fit * 0.85 + depth * 0.15 - outOfPosition * 6 - (fixWarnings ? warn * 2 : 0),
    warnings: fixWarnings ? roleWarnings(slots, ctx.roles, ctx.warnings, ctx.codes) : [],
    changes,
    leftOut,
  }
}

/** The squad's 11 best players by their best role at a position they play. */
function bestPlayers(ctx: BuildContext, score: Scorer) {
  return ctx.squad
    .map((p) => {
      const s = ctx.roles
        .filter((r) => r.positions.some((pos) => playsPositionText(p, pos)))
        .map((r) => score(p, r) ?? 0)
      return { player: p, score: Math.max(0, ...s) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 11)
}
const playsPositionText = (p: PlayerRow, text: string) => {
  const code = (Object.keys(POSITION_TEXT) as PositionCode[]).find(
    (c) => POSITION_TEXT[c] === text || (c === 'ST' && text === 'ST'),
  )
  return code ? playsPosition(p, code) : false
}

/** Every shape built for the squad, best first; FM warnings are fixed for the top ones. */
export function buildAll(shapes: ShapeCandidate[], ctx: BuildContext, top = 12): BuiltTactic[] {
  const score = scoreTable(ctx)
  const rough = shapes
    .map((s) => buildShape(s, ctx, score, false))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, top)
  return rough.map((b) => buildShape(b.shape, ctx, score, true)).sort((a, b) => b.rank - a.rank)
}

/* ------------------------------------------------------------------ team instructions */

const SET_PIECES = ['Corners', 'Free Kick Taking']
const attr = (p: PlayerRow, name: string) => attrNumber(p.attributes[name])
const mean = (players: PlayerRow[], names: string[]) => {
  const v = players
    .flatMap((p) => names.map((n) => attr(p, n)))
    .filter((x): x is number => x !== null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
const r1 = (x: number) => Math.round(x * 10) / 10

const CB: PositionCode[] = ['DC']
const FB: PositionCode[] = ['DL', 'DR', 'WBL', 'WBR']
const DEF: PositionCode[] = [...CB, ...FB]
const MID: PositionCode[] = ['DM', 'MC', 'AMC']
const WIDE: PositionCode[] = ['ML', 'MR', 'AML', 'AMR', 'WBL', 'WBR']
const FRONT: PositionCode[] = ['AML', 'AMC', 'AMR', 'ST']
const OUTFIELD: PositionCode[] = [...DEF, 'DM', 'ML', 'MC', 'MR', ...FRONT]
const LEFT: PositionCode[] = ['DL', 'WBL', 'ML', 'AML']
const RIGHT: PositionCode[] = ['DR', 'WBR', 'MR', 'AMR']

export interface XiContext {
  /** Players at these in-possession positions. */
  at: (positions: PositionCode[]) => PlayerRow[]
  /** All XI players with their slot. */
  xi: { p: PlayerRow; slot: TacticSlot; index: number }[]
}

export function xiContext(slots: TacticSlot[], squad: PlayerRow[]): XiContext {
  const xi = slots.flatMap((slot, index) => {
    const p = squad.find((x) => x.id === slot.player)
    return p ? [{ p, slot, index }] : []
  })
  return {
    xi,
    at: (positions) =>
      xi.filter((x) => x.slot.position && positions.includes(x.slot.position)).map((x) => x.p),
  }
}

/** A rule of thumb that sets one team instruction from the XI's attributes. */
export interface TeamRule {
  id: string
  instruction: string
  name: string
  /** Shown in Settings: what the rule does and why. */
  about: string
  check: (c: XiContext) => { to: string; why: string } | null
}

/** Steps of a scale by the group's average. */
const scale = (v: number, steps: [number, string][], below: string) =>
  steps.find(([min]) => v >= min)?.[1] ?? below

export const TEAM_RULES: TeamRule[] = [
  {
    id: 'line-height',
    instruction: 'Defensive line height',
    name: 'Line height from the centre-backs’ pace',
    about:
      'Centre-backs’ average Pace and Acceleration: 15+ Much higher, 13+ Higher, 11+ Standard, 9+ Lower, below Much lower. Slow defenders get run in behind a high line.',
    check: (c) => {
      const v = mean(c.at(CB), ['Pace', 'Acceleration'])
      if (v === null) return null
      return {
        to: scale(
          v,
          [
            [15, 'Much higher'],
            [13, 'Higher'],
            [11, 'Standard'],
            [9, 'Lower'],
          ],
          'Much lower',
        ),
        why: `Centre-backs average ${r1(v)} in Pace and Acceleration.`,
      }
    },
  },
  {
    id: 'line-behaviour',
    instruction: 'Defensive line behaviour',
    name: 'Slow but smart defenders drop off',
    about:
      'Centre-backs under 11 in Pace and Acceleration but 13+ in Anticipation and Positioning drop off rather than step up; 14+ in pace and reading the game, they step up.',
    check: (c) => {
      const pace = mean(c.at(CB), ['Pace', 'Acceleration'])
      const read = mean(c.at(CB), ['Anticipation', 'Positioning'])
      if (pace === null || read === null) return null
      if (pace < 11 && read >= 13)
        return {
          to: 'Drop off more',
          why: `Centre-backs: pace ${r1(pace)}, reading the game ${r1(read)}.`,
        }
      if (pace >= 14 && read >= 14)
        return {
          to: 'Step up more',
          why: `Centre-backs: pace ${r1(pace)}, reading the game ${r1(read)}.`,
        }
      return null
    },
  },
  {
    id: 'engagement',
    instruction: 'Line of engagement',
    name: 'Where to engage from the front players’ legs',
    about:
      'Attackers and midfielders’ average Work Rate, Stamina and Pace: 14+ High press, under 11 Low block, otherwise Mid block.',
    check: (c) => {
      const v = mean(c.at([...FRONT, ...MID, 'ML', 'MR']), ['Work Rate', 'Stamina', 'Pace'])
      if (v === null) return null
      return {
        to: v >= 14 ? 'High press' : v < 11 ? 'Low block' : 'Mid block',
        why: `Attackers and midfielders average ${r1(v)} in Work Rate, Stamina and Pace.`,
      }
    },
  },
  {
    id: 'press',
    instruction: 'Trigger press',
    name: 'Press as much as the XI can run',
    about:
      'Outfield average Work Rate, Stamina, Aggression and Teamwork: 15+ Much more often, 13+ More often, 10.5+ Standard, below Less often.',
    check: (c) => {
      const v = mean(c.at(OUTFIELD), ['Work Rate', 'Stamina', 'Aggression', 'Teamwork'])
      if (v === null) return null
      return {
        to: scale(
          v,
          [
            [15, 'Much more often'],
            [13, 'More often'],
            [10.5, 'Standard'],
          ],
          'Less often',
        ),
        why: `Outfield players average ${r1(v)} in Work Rate, Stamina, Aggression and Teamwork.`,
      }
    },
  },
  {
    id: 'def-transition',
    instruction: 'Defensive transition',
    name: 'Counter-press or regroup',
    about:
      'Outfield average Work Rate, Anticipation and Stamina: 14+ Counter-press when the ball is lost, under 11 Regroup.',
    check: (c) => {
      const v = mean(c.at(OUTFIELD), ['Work Rate', 'Anticipation', 'Stamina'])
      if (v === null || (v < 14 && v >= 11)) return null
      return {
        to: v >= 14 ? 'Counter-press' : 'Regroup',
        why: `Outfield players average ${r1(v)} in Work Rate, Anticipation and Stamina.`,
      }
    },
  },
  {
    id: 'tackling',
    instruction: 'Tackling',
    name: 'Tackling from the defenders’ tackling',
    about:
      'Defenders and defensive midfielders: 14+ in Tackling, Bravery and Aggression get stuck in; under 10 in Tackling stay on their feet.',
    check: (c) => {
      const g = c.at([...DEF, 'DM'])
      const hard = mean(g, ['Tackling', 'Bravery', 'Aggression'])
      const tack = mean(g, ['Tackling'])
      if (hard === null || tack === null) return null
      if (hard >= 14)
        return {
          to: 'Get stuck in',
          why: `Defenders average ${r1(hard)} in Tackling, Bravery and Aggression.`,
        }
      if (tack < 10)
        return { to: 'Stay on feet', why: `Defenders average ${r1(tack)} in Tackling.` }
      return null
    },
  },
  {
    id: 'build-up',
    instruction: 'Build-up strategy',
    name: 'Build-up from the defenders’ technique',
    about:
      'Defenders and DMs’ average Passing, Composure, First Touch and Technique: 14+ Play through the press, under 10.5 Bypass the press.',
    check: (c) => {
      const v = mean(c.at([...DEF, 'DM']), ['Passing', 'Composure', 'First Touch', 'Technique'])
      if (v === null || (v < 14 && v >= 10.5)) return null
      return {
        to: v >= 14 ? 'Play through the press' : 'Bypass the press',
        why: `Defenders and DMs average ${r1(v)} in Passing, Composure, First Touch and Technique.`,
      }
    },
  },
  {
    id: 'directness',
    instruction: 'Passing directness',
    name: 'Short or direct from the midfield and the striker',
    about:
      'Central midfielders’ Passing, Vision, Technique and Decisions: 15+ Shorter passes, under 11 More direct passes; also More direct when a striker is 15+ in Heading, Jumping Reach and Strength and the midfield is under 13.',
    check: (c) => {
      const mid = mean(c.at(MID), ['Passing', 'Vision', 'Technique', 'Decisions'])
      if (mid === null) return null
      if (mid >= 15)
        return {
          to: 'Shorter passes',
          why: `Central midfield averages ${r1(mid)} in Passing, Vision, Technique and Decisions.`,
        }
      const air = Math.max(
        0,
        ...c.at(['ST']).map((p) => mean([p], ['Heading', 'Jumping Reach', 'Strength']) ?? 0),
      )
      if (mid < 11 || (air >= 15 && mid < 13))
        return {
          to: 'More direct passes',
          why: `Central midfield averages ${r1(mid)} in passing and vision${air >= 15 ? `; a striker averages ${r1(air)} in the air and Strength` : ''}.`,
        }
      return null
    },
  },
  {
    id: 'tempo',
    instruction: 'Tempo',
    name: 'Tempo from the team’s speed of thought',
    about:
      'Outfield average Decisions, Anticipation, First Touch and Technique: 14.5+ Higher, under 10.5 Lower.',
    check: (c) => {
      const v = mean(c.at(OUTFIELD), ['Decisions', 'Anticipation', 'First Touch', 'Technique'])
      if (v === null || (v < 14.5 && v >= 10.5)) return null
      return {
        to: v >= 14.5 ? 'Higher' : 'Lower',
        why: `Outfield players average ${r1(v)} in Decisions, Anticipation, First Touch and Technique.`,
      }
    },
  },
  {
    id: 'width',
    instruction: 'Attacking width',
    name: 'Width from the wide players',
    about:
      'No wide players in possession: Narrower. Wide players averaging 14+ in Pace, Dribbling and Crossing: Wider.',
    check: (c) => {
      const wide = c.at(WIDE)
      if (!wide.length) return { to: 'Narrower', why: 'No wide players in possession.' }
      const v = mean(wide, ['Pace', 'Dribbling', 'Crossing'])
      if (v === null || v < 14) return null
      return { to: 'Wider', why: `Wide players average ${r1(v)} in Pace, Dribbling and Crossing.` }
    },
  },
  {
    id: 'counter',
    instruction: 'Attacking transition',
    name: 'Counter with quick forwards',
    about:
      'Attackers averaging 15+ in Pace and Acceleration: Counter-attack when the ball is won. Slow attackers (under 11) with a passing midfield (14+): Hold shape.',
    check: (c) => {
      const pace = mean(c.at(FRONT), ['Pace', 'Acceleration'])
      if (pace === null) return null
      if (pace >= 15)
        return {
          to: 'Counter-attack',
          why: `Attackers average ${r1(pace)} in Pace and Acceleration.`,
        }
      const mid = mean(c.at(MID), ['Passing', 'Vision'])
      if (pace < 11 && mid !== null && mid >= 14)
        return {
          to: 'Hold shape',
          why: `Attackers average ${r1(pace)} in pace; midfield ${r1(mid)} in Passing and Vision.`,
        }
      return null
    },
  },
  {
    id: 'freedom',
    instruction: 'Creative freedom',
    name: 'Freedom for a creative XI',
    about:
      'XI average Flair, Vision and Decisions: 14+ Be more expressive, under 10 Be more disciplined.',
    check: (c) => {
      const v = mean(c.at(OUTFIELD), ['Flair', 'Vision', 'Decisions'])
      if (v === null || (v < 14 && v >= 10)) return null
      return {
        to: v >= 14 ? 'Be more expressive' : 'Be more disciplined',
        why: `Outfield players average ${r1(v)} in Flair, Vision and Decisions.`,
      }
    },
  },
  {
    id: 'reception',
    instruction: 'Pass reception',
    name: 'Into space for quick forwards, to feet for technical ones',
    about:
      'Attackers 15+ in Pace and Acceleration: Pass into space. Attackers under 13 in pace but 15+ in First Touch and Technique: Pass to feet.',
    check: (c) => {
      const f = c.at(FRONT)
      const pace = mean(f, ['Pace', 'Acceleration'])
      const touch = mean(f, ['First Touch', 'Technique'])
      if (pace === null || touch === null) return null
      if (pace >= 15)
        return {
          to: 'Pass into space',
          why: `Attackers average ${r1(pace)} in Pace and Acceleration.`,
        }
      if (pace < 13 && touch >= 15)
        return {
          to: 'Pass to feet',
          why: `Attackers: pace ${r1(pace)}, First Touch and Technique ${r1(touch)}.`,
        }
      return null
    },
  },
  {
    id: 'crossing',
    instruction: 'Crossing style',
    name: 'Crosses for the striker you have',
    about:
      'A striker 15+ in Heading and Jumping Reach: Floated crosses. Strikers under 11 in Heading: Low crosses. Otherwise, wide players 15+ in Crossing: Whipped crosses.',
    check: (c) => {
      const st = c.at(['ST'])
      if (!st.length) return null
      const air = Math.max(
        ...st.map((p) => Math.min(attr(p, 'Heading') ?? 0, attr(p, 'Jumping Reach') ?? 0)),
      )
      if (air >= 15)
        return { to: 'Floated crosses', why: `A striker has ${air}+ in Heading and Jumping Reach.` }
      const head = Math.max(...st.map((p) => attr(p, 'Heading') ?? 0))
      if (head < 11) return { to: 'Low crosses', why: `The strikers’ best Heading is ${head}.` }
      const cross = mean(c.at([...WIDE, 'DL', 'DR']), ['Crossing'])
      if (cross !== null && cross >= 15)
        return { to: 'Whipped crosses', why: `Wide players average ${r1(cross)} in Crossing.` }
      return null
    },
  },
  {
    id: 'patience',
    instruction: 'Patience',
    name: 'Early crosses for a target, work it in otherwise',
    about:
      'A striker 15+ in Heading and Jumping Reach and wide players 14+ in Crossing: Hit early crosses. No striker over 11 in Heading and a technical midfield (14+ in Passing and Technique): Work ball into box.',
    check: (c) => {
      const st = c.at(['ST'])
      const air = Math.max(
        0,
        ...st.map((p) => Math.min(attr(p, 'Heading') ?? 0, attr(p, 'Jumping Reach') ?? 0)),
      )
      const cross = mean(c.at([...WIDE, 'DL', 'DR']), ['Crossing'])
      if (air >= 15 && cross !== null && cross >= 14)
        return {
          to: 'Hit early crosses',
          why: `Striker ${air}+ in the air; wide players ${r1(cross)} in Crossing.`,
        }
      const head = Math.max(0, ...st.map((p) => attr(p, 'Heading') ?? 0))
      const mid = mean(c.at(MID), ['Passing', 'Technique'])
      if (head <= 11 && mid !== null && mid >= 14)
        return {
          to: 'Work ball into box',
          why: `Best striker Heading ${head}; midfield ${r1(mid)} in Passing and Technique.`,
        }
      return null
    },
  },
  {
    id: 'dribbling',
    instruction: 'Dribbling',
    name: 'Dribble with good dribblers',
    about: 'Attackers 15+ in Dribbling and Flair: Encourage. Under 10: Discourage.',
    check: (c) => {
      const v = mean(c.at(FRONT), ['Dribbling', 'Flair'])
      if (v === null || (v < 15 && v >= 10)) return null
      return {
        to: v >= 15 ? 'Encourage' : 'Discourage',
        why: `Attackers average ${r1(v)} in Dribbling and Flair.`,
      }
    },
  },
  {
    id: 'long-shots',
    instruction: 'Shots from distance',
    name: 'Shoot from distance with good long-range shooters',
    about:
      'Two or more midfielders or attackers with 15+ Long Shots: Encourage. None over 11: Discourage.',
    check: (c) => {
      const g = c.at([...MID, ...FRONT, 'ML', 'MR'])
      if (!g.length) return null
      const n = g.filter((p) => (attr(p, 'Long Shots') ?? 0) >= 15).length
      if (n >= 2)
        return { to: 'Encourage', why: `${n} players in the XI have Long Shots 15 or more.` }
      const best = Math.max(...g.map((p) => attr(p, 'Long Shots') ?? 0))
      if (best <= 11)
        return { to: 'Discourage', why: `The best Long Shots in midfield and attack is ${best}.` }
      return null
    },
  },
  {
    id: 'overlap',
    instruction: 'Overlap',
    name: 'Overlap with attacking full-backs',
    about:
      'A full-back or wing-back 14+ in Crossing, Off the Ball and Stamina overlaps on his flank (both flanks when both are).',
    check: (c) => {
      const good = (side: PositionCode[]) => {
        const v = mean(c.at(side.filter((p) => FB.includes(p))), [
          'Crossing',
          'Off The Ball',
          'Stamina',
        ])
        return v !== null && v >= 14 ? v : null
      }
      const l = good(LEFT)
      const r = good(RIGHT)
      if (l && r)
        return {
          to: 'Overlap both flanks',
          why: `Full-backs: left ${r1(l)}, right ${r1(r)} in Crossing, Off the Ball and Stamina.`,
        }
      if (l)
        return {
          to: 'Overlap left',
          why: `Left full-back ${r1(l)} in Crossing, Off the Ball and Stamina.`,
        }
      if (r)
        return {
          to: 'Overlap right',
          why: `Right full-back ${r1(r)} in Crossing, Off the Ball and Stamina.`,
        }
      return null
    },
  },
  {
    id: 'progress',
    instruction: 'Progress through',
    name: 'Attack through the stronger side',
    about:
      'Compares the left and right flank (Pace, Dribbling, Crossing of the players there) with the centre (Passing, Vision, Dribbling of central midfield and attack): goes through the one at least 1.5 better than the others.',
    check: (c) => {
      const flank = (side: PositionCode[]) => mean(c.at(side), ['Pace', 'Dribbling', 'Crossing'])
      const l = flank(LEFT)
      const r = flank(RIGHT)
      const m = mean(c.at([...MID, 'ST']), ['Passing', 'Vision', 'Dribbling'])
      const all: [string, number | null][] = [
        ['Left flank', l],
        ['Right flank', r],
        ['Centre', m],
      ]
      const known = all
        .filter((x): x is [string, number] => x[1] !== null)
        .sort((a, b) => b[1] - a[1])
      if (known.length < 2 || known[0][1] - known[1][1] < 1.5) return null
      return {
        to: known[0][0],
        why: known.map(([n, v]) => `${n.toLowerCase()} ${r1(v)}`).join(', ') + '.',
      }
    },
  },
  {
    id: 'cross-engagement',
    instruction: 'Cross engagement',
    name: 'Invite crosses with tall centre-backs',
    about:
      'Centre-backs 15+ in Heading and Jumping Reach: Invite crosses. Under 11.5: Stop crosses.',
    check: (c) => {
      const v = mean(c.at(CB), ['Heading', 'Jumping Reach'])
      if (v === null || (v < 15 && v >= 11.5)) return null
      return {
        to: v >= 15 ? 'Invite crosses' : 'Stop crosses',
        why: `Centre-backs average ${r1(v)} in Heading and Jumping Reach.`,
      }
    },
  },
  {
    id: 'goal-kicks',
    instruction: 'Goal kicks',
    name: 'Goal kicks from the goalkeeper and the build-up',
    about:
      'Goalkeeper 14+ in Passing with defenders 13+ in Passing and Composure: Shorter passes. Goalkeeper 15+ in Kicking with a striker 15+ in the air: Long passing.',
    check: (c) => {
      const gk = c.at(['GK'])[0]
      if (!gk) return null
      const defs = mean(c.at(DEF), ['Passing', 'Composure'])
      if ((attr(gk, 'Passing') ?? 0) >= 14 && defs !== null && defs >= 13)
        return {
          to: 'Shorter passes',
          why: `Goalkeeper Passing ${attr(gk, 'Passing')}; defenders ${r1(defs)} in Passing and Composure.`,
        }
      const air = Math.max(
        0,
        ...c
          .at(['ST'])
          .map((p) => Math.min(attr(p, 'Heading') ?? 0, attr(p, 'Jumping Reach') ?? 0)),
      )
      if ((attr(gk, 'Kicking') ?? 0) >= 15 && air >= 15)
        return {
          to: 'Long passing',
          why: `Goalkeeper Kicking ${attr(gk, 'Kicking')}; striker ${air}+ in the air.`,
        }
      return null
    },
  },
  {
    id: 'set-pieces',
    instruction: 'Play for set pieces',
    name: 'Play for set pieces with a taker and targets',
    about:
      'A taker 15+ in Corners or Free Kick Taking and two or more players 15+ in Heading and Jumping Reach: Play for set pieces.',
    check: (c) => {
      const all = c.xi.map((x) => x.p)
      const taker = Math.max(0, ...all.flatMap((p) => SET_PIECES.map((a) => attr(p, a) ?? 0)))
      const targets = all.filter(
        (p) => Math.min(attr(p, 'Heading') ?? 0, attr(p, 'Jumping Reach') ?? 0) >= 15,
      ).length
      if (taker < 15 || targets < 2) return null
      return {
        to: 'Play for set pieces',
        why: `Best set-piece taker ${taker}; ${targets} players 15+ in the air.`,
      }
    },
  },
]

export interface TeamSuggestion {
  rule: string
  name: string
  instruction: string
  from: string
  to: string
  why: string
  code: number
}

/** Team instructions the rules suggest for this XI (only those that change something). */
export function teamSuggestions(
  slots: TacticSlot[],
  squad: PlayerRow[],
  base: number[],
  defs: FmInstruction[],
  enabled: Record<string, boolean>,
): TeamSuggestion[] {
  const c = xiContext(slots, squad)
  return TEAM_RULES.filter((r) => enabled[r.id] !== false).flatMap((r) => {
    const d = defs.find((x) => x.name === r.instruction)
    const hit = d && r.check(c)
    const option = hit && d.options.find((o) => o.label === hit.to)
    if (!d || !hit || !option) return []
    const from = chosen(d, base)?.label ?? d.options.find((o) => o.code === 0)?.label ?? '?'
    if (from === option.label) return []
    return [
      {
        rule: r.id,
        name: r.name,
        instruction: d.name,
        from,
        to: option.label,
        why: hit.why,
        code: option.code,
      },
    ]
  })
}

/** Team instruction codes with the chosen suggestions applied. */
export function applyTeam(base: number[], picks: TeamSuggestion[], defs: FmInstruction[]) {
  return picks.reduce((codes, s) => {
    const d = defs.find((x) => x.name === s.instruction)
    return d ? choose(d, codes, s.code) : codes
  }, base)
}

/* ------------------------------------------------------------------ player instructions */

/** A rule of thumb that sets one player instruction from the player's attributes. */
export interface PlayerRule {
  id: string
  instruction: string
  name: string
  about: string
  check: (p: PlayerRow, pos: PositionCode, feet: Feet) => { to: string; why: string } | null
}
/** Foot strength as steps (0 weakest), when known. */
export type Feet = { left: number | null; right: number | null }

const ATTACKING: PositionCode[] = ['MC', 'ML', 'MR', 'AML', 'AMC', 'AMR', 'ST']
const a = (p: PlayerRow, n: string) => attr(p, n) ?? 0

export const PLAYER_RULES: PlayerRule[] = [
  {
    id: 'pi-shoot',
    instruction: 'Shooting',
    name: 'Shoot more with good long shots',
    about:
      'Long Shots 15+ and Finishing 12+: Shoot more often. Midfielders and attackers with Long Shots 8 or less: Shoot less often.',
    check: (p, pos) => {
      if (a(p, 'Long Shots') >= 15 && a(p, 'Finishing') >= 12)
        return {
          to: 'Shoot more often',
          why: `Long Shots ${a(p, 'Long Shots')}, Finishing ${a(p, 'Finishing')}.`,
        }
      if (ATTACKING.includes(pos) && pos !== 'ST' && a(p, 'Long Shots') <= 8)
        return { to: 'Shoot less often', why: `Long Shots ${a(p, 'Long Shots')}.` }
      return null
    },
  },
  {
    id: 'pi-dribble',
    instruction: 'Dribbling frequency',
    name: 'Dribble more with good dribblers',
    about:
      'Dribbling 15+ and Flair 13+: Dribble more. Midfielders and attackers with Dribbling 9 or less: Dribble less.',
    check: (p, pos) => {
      if (a(p, 'Dribbling') >= 15 && a(p, 'Flair') >= 13)
        return {
          to: 'Dribble more',
          why: `Dribbling ${a(p, 'Dribbling')}, Flair ${a(p, 'Flair')}.`,
        }
      if (ATTACKING.includes(pos) && a(p, 'Dribbling') <= 9)
        return { to: 'Dribble less', why: `Dribbling ${a(p, 'Dribbling')}.` }
      return null
    },
  },
  {
    id: 'pi-direction',
    instruction: 'Dribbling direction',
    name: 'Cut inside on the wrong foot, go wide on the right one',
    about:
      'Wide players with Dribbling 13+: cut inside when their stronger foot is the inside one, run wide when it is the outside one and Crossing is 14+.',
    check: (p, pos, feet) => {
      const left = LEFT.includes(pos)
      if ((!left && !RIGHT.includes(pos)) || a(p, 'Dribbling') < 13) return null
      if (feet.left === null || feet.right === null || feet.left === feet.right) return null
      const inside = left ? feet.right > feet.left : feet.left > feet.right
      if (inside)
        return {
          to: 'Cut inside with ball',
          why: `${left ? 'Right' : 'Left'}-footed on the ${left ? 'left' : 'right'}, Dribbling ${a(p, 'Dribbling')}.`,
        }
      if (a(p, 'Crossing') >= 14)
        return {
          to: 'Run wide with ball',
          why: `Stronger foot on the outside, Crossing ${a(p, 'Crossing')}.`,
        }
      return null
    },
  },
  {
    id: 'pi-risk',
    instruction: 'Passing risk',
    name: 'More risks for passers with vision',
    about:
      'Vision and Passing 15+: Take more risks. Vision or Decisions 9 or less: Take fewer risks.',
    check: (p) => {
      if (a(p, 'Vision') >= 15 && a(p, 'Passing') >= 15)
        return {
          to: 'Take more risks',
          why: `Vision ${a(p, 'Vision')}, Passing ${a(p, 'Passing')}.`,
        }
      if (a(p, 'Vision') <= 9 || a(p, 'Decisions') <= 9)
        return {
          to: 'Take fewer risks',
          why: `Vision ${a(p, 'Vision')}, Decisions ${a(p, 'Decisions')}.`,
        }
      return null
    },
  },
  {
    id: 'pi-cross-from',
    instruction: 'Cross from',
    name: 'Cross from deep for good crossers without pace',
    about:
      'Crossing 15+ and Pace under 13: Cross from deep. Pace and Dribbling 15+: Cross from byline.',
    check: (p, pos) => {
      if (![...WIDE, 'DL', 'DR'].includes(pos)) return null
      if (a(p, 'Crossing') >= 15 && a(p, 'Pace') < 13)
        return { to: 'Cross from deep', why: `Crossing ${a(p, 'Crossing')}, Pace ${a(p, 'Pace')}.` }
      if (a(p, 'Pace') >= 15 && a(p, 'Dribbling') >= 15)
        return {
          to: 'Cross from byline',
          why: `Pace ${a(p, 'Pace')}, Dribbling ${a(p, 'Dribbling')}.`,
        }
      return null
    },
  },
  {
    id: 'pi-hold-up',
    instruction: 'Hold up ball',
    name: 'Hold up the ball with a strong striker',
    about: 'Strikers 15+ in Strength, Balance and First Touch: hold up the ball.',
    check: (p, pos) => {
      if (pos !== 'ST') return null
      const v = (a(p, 'Strength') + a(p, 'Balance') + a(p, 'First Touch')) / 3
      return v >= 15
        ? {
            to: 'Yes',
            why: `Strength ${a(p, 'Strength')}, Balance ${a(p, 'Balance')}, First Touch ${a(p, 'First Touch')}.`,
          }
        : null
    },
  },
  {
    id: 'pi-runs',
    instruction: 'Forward runs',
    name: 'Forward runs from the legs and the movement',
    about:
      'Off the Ball 15+ and Stamina 13+: Make more runs. Defenders and midfielders with Stamina 9 or less: Hold position.',
    check: (p, pos) => {
      if (pos === 'GK') return null
      if (a(p, 'Off The Ball') >= 15 && a(p, 'Stamina') >= 13)
        return {
          to: 'Make more runs',
          why: `Off the Ball ${a(p, 'Off The Ball')}, Stamina ${a(p, 'Stamina')}.`,
        }
      if (!FRONT.includes(pos) && a(p, 'Stamina') <= 9)
        return { to: 'Hold position', why: `Stamina ${a(p, 'Stamina')}.` }
      return null
    },
  },
  {
    id: 'pi-press',
    instruction: 'Trigger press',
    name: 'Press more with tireless players',
    about: 'Work Rate and Stamina 15+: press more often. Either 9 or less: press less often.',
    check: (p, pos) => {
      if (pos === 'GK') return null
      if (a(p, 'Work Rate') >= 15 && a(p, 'Stamina') >= 15)
        return {
          to: 'More often',
          why: `Work Rate ${a(p, 'Work Rate')}, Stamina ${a(p, 'Stamina')}.`,
        }
      if (a(p, 'Work Rate') <= 9 || a(p, 'Stamina') <= 9)
        return {
          to: 'Less often',
          why: `Work Rate ${a(p, 'Work Rate')}, Stamina ${a(p, 'Stamina')}.`,
        }
      return null
    },
  },
  {
    id: 'pi-tackle',
    instruction: 'Tackling',
    name: 'Tackle hard with good tacklers, ease off with poor ones',
    about:
      'Tackling 15+ and Aggression 13+: Tackle harder. Defenders and DMs with Tackling 9 or less: Ease off tackles.',
    check: (p, pos) => {
      if (pos === 'GK') return null
      if (a(p, 'Tackling') >= 15 && a(p, 'Aggression') >= 13)
        return {
          to: 'Tackle harder',
          why: `Tackling ${a(p, 'Tackling')}, Aggression ${a(p, 'Aggression')}.`,
        }
      if ([...DEF, 'DM'].includes(pos) && a(p, 'Tackling') <= 9)
        return { to: 'Ease off tackles', why: `Tackling ${a(p, 'Tackling')}.` }
      return null
    },
  },
  {
    id: 'pi-mark',
    instruction: 'Marking',
    name: 'Mark tighter with good markers',
    about: 'Marking 15+ and Concentration 13+: Mark tighter.',
    check: (p, pos) =>
      pos !== 'GK' && a(p, 'Marking') >= 15 && a(p, 'Concentration') >= 13
        ? {
            to: 'Mark tighter',
            why: `Marking ${a(p, 'Marking')}, Concentration ${a(p, 'Concentration')}.`,
          }
        : null,
  },
]

export interface PlayerSuggestion {
  slot: number
  rule: string
  player: string
  instruction: string
  phase: 'ip' | 'oop'
  to: string
  why: string
  code: number
}

/**
 * Player instructions the rules suggest, only where FM offers the option for the player's
 * role at his FM position (and the role does not force another).
 */
export function playerSuggestions(
  slots: TacticSlot[],
  squad: PlayerRow[],
  roles: RoleDef[],
  codes: FmCodes,
  defs: FmInstruction[],
  enabled: Record<string, boolean>,
  feet: (p: PlayerRow) => Feet,
): PlayerSuggestion[] {
  const fm = { ip: fmPositions(slots, 'ip', codes), oop: fmPositions(slots, 'oop', codes) }
  return slots.flatMap((s, i) => {
    const p = squad.find((x) => x.id === s.player)
    if (!p || !s.position) return []
    return PLAYER_RULES.filter((r) => enabled[r.id] !== false).flatMap((r) => {
      const d = defs.find((x) => x.name === r.instruction)
      if (!d) return []
      const phase = d.phase
      const pos = phase === 'ip' ? s.position! : (s.positionOop ?? s.position!)
      const hit = r.check(p, pos, feet(p))
      if (!hit) return []
      const role = roles.find((x) => x.id === (phase === 'ip' ? s.role : s.roleOop)) ?? null
      const { options, forced } = playerChoices(d, role, fm[phase][i])
      const option = options.find((o) => o.label === hit.to)
      if (forced || !option || !option.code) return []
      return [
        {
          slot: i,
          rule: r.id,
          player: p.name,
          instruction: d.name,
          phase,
          to: option.label,
          why: hit.why,
          code: option.code,
        },
      ]
    })
  })
}

/** Slots with the chosen player instructions set. */
export function applyPlayers(
  slots: TacticSlot[],
  picks: PlayerSuggestion[],
  defs: FmInstruction[],
) {
  return slots.map((s, i) =>
    picks
      .filter((x) => x.slot === i)
      .reduce((slot, x) => {
        const d = defs.find((y) => y.name === x.instruction)
        if (!d) return slot
        return x.phase === 'ip'
          ? { ...slot, pi: choose(d, slot.pi ?? [], x.code) }
          : { ...slot, piOop: choose(d, slot.piOop ?? [], x.code) }
      }, s),
  )
}
