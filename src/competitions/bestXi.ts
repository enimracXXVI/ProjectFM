/**
 * Best XI: the club's best player for each position of a formation, over one season or all of
 * them. Each player scores his rating above a baseline, weighted by minutes played:
 * sum of (rating - baseline) x minutes / 90 over his official matches. Playing often counts,
 * so a regular beats a short burst of high ratings.
 */
import { parsePositions } from '../lib/roleFit'
import type { PositionCode } from '../tactics/types'
import type { CompetitionKind, CompetitionsFile } from './types'

export interface PlayerSeason {
  id: number
  name: string
  matches: number
  minutes: number
  /** Average match rating. */
  rating: number
  score: number
}

/** One player's official matches for the club, from the match reports (or FM's per-match rows). */
export function playerTotals(
  files: CompetitionsFile[],
  kindOf: (databaseId: number | null) => CompetitionKind | null,
  baseline: number,
): PlayerSeason[] {
  const acc = new Map<number, { name: string; matches: number; minutes: number; sum: number }>()
  const add = (id: number, name: string | null, minutes: number, rating: number | null) => {
    if (minutes <= 0 || rating === null) return
    const a = acc.get(id) ?? { name: name ?? '?', matches: 0, minutes: 0, sum: 0 }
    a.matches++
    a.minutes += minutes
    a.sum += rating * minutes
    if (name) a.name = name
    acc.set(id, a)
  }
  for (const file of files) {
    const official = new Set(
      file.competitions
        .filter((c) => {
          const k = kindOf(c.databaseId)
          return k === 'league' || k === 'cup'
        })
        .map((c) => c.id),
    )
    for (const comp of file.competitions) {
      if (!official.has(comp.id)) continue
      for (const f of comp.fixtures) {
        if (!f.played || (f.home !== file.club && f.away !== file.club)) continue
        if ((f.home === file.club ? f.homeSlot : f.awaySlot) ?? 0) continue
        const report = file.squads?.find(
          (s) => s.date === f.date && s.home === f.home && s.away === f.away,
        )
        const mine = f.home === file.club ? report?.homePlayers : report?.awayPlayers
        if (mine?.length) {
          for (const p of mine) {
            if (p.id === null || !(p.start || p.on)) continue
            add(p.id, p.name, Math.max(1, (p.off ?? 90) - (p.on ?? 0)), p.rating)
          }
          continue
        }
        // No match report kept: FM's own per-match rows for the club's players
        const opponent = f.home === file.club ? f.away : f.home
        for (const m of file.playerMatches) {
          if (m.comp !== comp.id || m.date !== f.date || m.opponent !== opponent) continue
          if (m.uniqueId === null || !m.minutes) continue
          add(m.uniqueId, m.name, m.minutes, m.rating)
        }
      }
    }
  }
  return [...acc.entries()].map(([id, a]) => {
    const rating = a.sum / a.minutes
    return {
      id,
      name: a.name,
      matches: a.matches,
      minutes: a.minutes,
      rating: Math.round(rating * 100) / 100,
      score: Math.round((rating - baseline) * (a.minutes / 90) * 10) / 10,
    }
  })
}

/** The position text FM uses for a tactic slot ("D (R)" for DR). */
export function slotPositions(code: PositionCode): string[] {
  if (code === 'GK') return ['GK']
  if (code === 'DM') return ['DM']
  if (code === 'ST') return ['ST', 'ST (C)']
  const side = code.slice(-1)
  const base = code.slice(0, -1)
  return [`${base} (${side})`]
}

export interface BestXiSlot {
  slot: number
  position: PositionCode
  player: PlayerSeason | null
}

/**
 * Fills the formation: best scores first, each player once, only in a position he can play.
 * `positionsOf` gives a player's FM positions text by Unique ID.
 */
export function bestXi(
  formation: PositionCode[],
  players: PlayerSeason[],
  positionsOf: (id: number) => string | null,
): BestXiSlot[] {
  const slots: BestXiSlot[] = formation.map((position, slot) => ({ slot, position, player: null }))
  const plays = new Map(players.map((p) => [p.id, new Set(parsePositions(positionsOf(p.id)))]))
  const ranked = [...players].sort((a, b) => b.score - a.score)
  const used = new Set<number>()
  for (const p of ranked) {
    if (used.has(p.id)) continue
    const can = plays.get(p.id)!
    const free = slots.find((s) => !s.player && slotPositions(s.position).some((x) => can.has(x)))
    if (free) {
      free.player = p
      used.add(p.id)
    }
  }
  return slots
}
