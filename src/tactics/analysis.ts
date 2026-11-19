/**
 * Squad fit for a tactic: how well each player suits his slot (position and roles in both
 * phases), the best possible XI, better roles or players per slot, and bench cover.
 * Scores are the app's role-fit scores (0–100, Settings > Role weights).
 */
import type { PlayerRow } from '../data/db'
import type { RoleDef } from '../data/roles'
import { parsePositions, roleScore, type RoleWeights } from '../lib/roleFit'
import { parsePositionRatings } from '../lib/attributes'
import { POSITION_TEXT } from './positions'
import { fmPositions, rolesAt, shapeOf, slotSides, type FmCodes } from './fm'
import type { PositionCode, TacticSlot } from './types'

export interface FitContext {
  roles: RoleDef[]
  weights: RoleWeights
  /** With FM's codes, role suggestions keep to the roles FM offers at each position. */
  fmCodes?: FmCodes
  /** Foot strength, to put the more left-footed of a pair on the left. */
  foot?: (p: PlayerRow) => Feet
}

/** Foot strength as steps (0 weakest), when known. */
export type Feet = { left: number | null; right: number | null }

/**
 * Pairs of the same position (left and right centre-backs, midfielders, strikers…): the more
 * left-footed player goes on the left. `allow` can refuse a swap (a locked slot, a big loss).
 */
export function footSides(
  slots: TacticSlot[],
  players: (string | null)[],
  squad: PlayerRow[],
  foot: (p: PlayerRow) => Feet,
  allow: (l: number, r: number) => boolean = () => true,
): (string | null)[] {
  const out = [...players]
  const positions = slots.map((s) => s.position)
  const sides = slotSides(
    positions,
    slots.map((s) => s.side),
  )
  const lean = (id: string | null) => {
    const p = id ? squad.find((x) => x.id === id) : undefined
    const f = p ? foot(p) : null
    return f && f.left !== null && f.right !== null ? f.left - f.right : null
  }
  for (const base of ['DC', 'DM', 'MC', 'AMC', 'ST'] as PositionCode[]) {
    const l = positions.findIndex((p, i) => p === base && sides[i] === 'L')
    const r = positions.findIndex((p, i) => p === base && sides[i] === 'R')
    if (l < 0 || r < 0) continue
    const a = lean(out[l])
    const b = lean(out[r])
    if (a === null || b === null || b <= a || !allow(l, r)) continue
    ;[out[l], out[r]] = [out[r], out[l]]
  }
  return out
}

const roleById = (ctx: FitContext, id: string | null | undefined) =>
  (id && ctx.roles.find((r) => r.id === id)) || null

/** Can the player play this position (FM's natural or accomplished positions)? */
export function playsPosition(p: PlayerRow, pos: PositionCode | null): boolean {
  if (!pos) return false
  // "ST" and "ST (C)" are the same position
  const plays = parsePositions(p.positions).map((x) => (x === 'ST' ? 'ST (C)' : x))
  return plays.includes(POSITION_TEXT[pos])
}

/** A player's score in a slot: the average of his role scores in the phases that have a role. */
export function slotScore(p: PlayerRow, slot: TacticSlot, ctx: FitContext): number | null {
  const scores = [roleById(ctx, slot.role), roleById(ctx, slot.roleOop)]
    .filter((r): r is RoleDef => !!r)
    .map((r) => roleScore(p.attributes, r, ctx.weights))
    .filter((s): s is number => s !== null)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

export interface SlotFit {
  slot: number
  player: PlayerRow | null
  score: number | null
  /** The player does not have the slot's position (in possession). */
  outOfPosition: boolean
}

/** Score of each slot with the players set in the tactic, and the team's average. */
export function gradeTactic(slots: TacticSlot[], squad: PlayerRow[], ctx: FitContext) {
  const fits: SlotFit[] = slots.map((s, i) => {
    const player = squad.find((p) => p.id === s.player) ?? null
    return {
      slot: i,
      player,
      score: player ? slotScore(player, s, ctx) : null,
      outOfPosition: !!player && !playsPosition(player, s.position),
    }
  })
  const scored = fits.filter((f) => f.score !== null).map((f) => f.score!)
  const team = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null
  return { fits, team }
}

/**
 * Minimum-cost assignment of rows to columns (Hungarian method, rows <= columns).
 * Returns the column chosen for each row.
 */
export function assign(cost: number[][]): number[] {
  const n = cost.length
  if (!n) return []
  const m = cost[0].length
  const INF = 1e18
  const u = new Array(n + 1).fill(0)
  const v = new Array(m + 1).fill(0)
  const p = new Array(m + 1).fill(0)
  const way = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(m + 1).fill(INF)
    const used = new Array(m + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = INF
      let j1 = 0
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else minv[j] -= delta
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0)
  }
  const out = new Array(n).fill(-1)
  for (let j = 1; j <= m; j++) if (p[j]) out[p[j] - 1] = j - 1
  return out
}

/**
 * The best XI for the tactic: the highest total score, each player once, players only in
 * positions they can play (unless nobody can), and locked slots kept as they are.
 */
export function bestXi(
  slots: TacticSlot[],
  squad: PlayerRow[],
  ctx: FitContext,
  locked: Set<number>,
): (string | null)[] {
  const fixed = new Set(slots.filter((_, i) => locked.has(i)).map((s) => s.player))
  const pool = squad.filter((p) => !fixed.has(p.id))
  const open = slots.map((_, i) => i).filter((i) => !locked.has(i))
  const result = slots.map((s) => s.player ?? null)
  if (!pool.length || !open.length) return result
  // Out of position costs much more than any in-position choice; no role scores as average
  const cost = open.map((i) =>
    pool.map((p) => {
      const score = slotScore(p, slots[i], ctx) ?? 50
      return playsPosition(p, slots[i].position) ? -score : 1000 - score
    }),
  )
  // More slots than players: pad with empty "players"
  const width = Math.max(pool.length, open.length)
  const padded = cost.map((row) => [...row, ...new Array(width - row.length).fill(5000)])
  const chosen = assign(padded)
  open.forEach((slot, k) => {
    const j = chosen[k]
    result[slot] = j >= 0 && j < pool.length ? pool[j].id : null
  })
  if (!ctx.foot) return result
  // Left-footed on the left, unless it costs more than a little fit (roles stay with slots)
  const scoreAt = (id: string | null, i: number) => {
    const p = id ? squad.find((x) => x.id === id) : undefined
    return p ? (slotScore(p, slots[i], ctx) ?? 50) : 0
  }
  return footSides(slots, result, squad, ctx.foot, (l, r) => {
    if (locked.has(l) || locked.has(r)) return false
    const now = scoreAt(result[l], l) + scoreAt(result[r], r)
    const swapped = scoreAt(result[r], l) + scoreAt(result[l], r)
    return now - swapped <= 3
  })
}

export interface Suggestion {
  slot: number
  kind: 'role' | 'player'
  /** Role id (for a role) or player id (for a player). */
  value: string
  label: string
  from: number | null
  to: number
}

/** For each slot: a clearly better role for the player there, or a clearly better player. */
export function suggestions(
  slots: TacticSlot[],
  squad: PlayerRow[],
  ctx: FitContext,
  margin = 5,
): Suggestion[] {
  const out: Suggestion[] = []
  const at = ctx.fmCodes ? fmPositions(slots, 'ip', ctx.fmCodes) : null
  const shape = shapeOf(slots, 'ip')
  slots.forEach((s, i) => {
    const player = squad.find((p) => p.id === s.player)
    const current = player ? slotScore(player, s, ctx) : null
    // Better in-possession role for the same player at the same position
    if (player && s.position) {
      const options = at
        ? rolesAt(ctx.roles, 'ip', at[i], shape, (p) => POSITION_TEXT[p])
        : ctx.roles.filter(
            (r) => r.phase === 'ip' && r.positions.includes(POSITION_TEXT[s.position!]),
          )
      let best: { r: RoleDef; score: number } | null = null
      for (const r of options) {
        const sc = slotScore(player, { ...s, role: r.id }, ctx)
        if (sc !== null && (!best || sc > best.score)) best = { r, score: sc }
      }
      if (best && best.r.id !== s.role && best.score >= (current ?? 0) + margin)
        out.push({
          slot: i,
          kind: 'role',
          value: best.r.id,
          label: best.r.name,
          from: current,
          to: best.score,
        })
    }
    // Better player for the slot as it is (one who can play the position)
    let bestP: { p: PlayerRow; score: number } | null = null
    for (const p of squad) {
      if (p.id === s.player || !playsPosition(p, s.position)) continue
      const sc = slotScore(p, s, ctx)
      if (sc !== null && (!bestP || sc > bestP.score)) bestP = { p, score: sc }
    }
    if (bestP && bestP.score >= (current ?? 0) + margin)
      out.push({
        slot: i,
        kind: 'player',
        value: bestP.p.id,
        label: bestP.p.name,
        from: current,
        to: bestP.score,
      })
  })
  return out
}

/** Best player outside the XI for each slot, and his score there. */
export function benchCover(slots: TacticSlot[], squad: PlayerRow[], ctx: FitContext) {
  const xi = new Set(slots.map((s) => s.player))
  return slots.map((s) => {
    let best: { player: PlayerRow; score: number } | null = null
    for (const p of squad) {
      if (xi.has(p.id) || !playsPosition(p, s.position)) continue
      const sc = slotScore(p, s, ctx)
      if (sc !== null && (!best || sc > best.score)) best = { player: p, score: sc }
    }
    return best
  })
}

/**
 * Puts a player in a slot. A player can only be in one slot: if he is already in another,
 * the two slots swap players.
 */
export function withPlayer(slots: TacticSlot[], i: number, player: string | null): TacticSlot[] {
  const from = player ? slots.findIndex((s, j) => j !== i && s.player === player) : -1
  return slots.map((s, j) =>
    j === i ? { ...s, player } : j === from ? { ...s, player: slots[i].player ?? null } : s,
  )
}

/** The player's FM rating (1–20) at a position, from the save; null when not known. */
export function positionRating(p: PlayerRow, pos: PositionCode | null | undefined): number | null {
  if (!pos) return null
  const v = parsePositionRatings(p.extra?.['Reader positions'])[pos]
  return v === undefined ? null : v
}

/**
 * Can he play there: his FM rating at the position is at least `min` (Settings > Tactics);
 * without ratings, the positions FM lists for him.
 */
export function canPlay(p: PlayerRow, pos: PositionCode | null | undefined, min: number): boolean {
  const r = positionRating(p, pos)
  return r === null ? playsPosition(p, pos ?? null) : r >= min
}
