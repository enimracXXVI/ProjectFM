/**
 * League tables from results. FM's own sorting rules for Serie A (Rules screen):
 * points, then results between the teams level on points (their points against each
 * other, then goal difference in those games), then goal difference, then goals scored.
 * Teams still level are listed by short name (as FM did for all 4 such pairs in the user's save).
 */
import type { Fixture } from './types'

export type Venue = 'all' | 'home' | 'away'
export type Outcome = 'W' | 'D' | 'L'

export interface TableRow {
  club: number
  name: string
  short: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
  /** Latest results last (up to 5). */
  form: Outcome[]
  position: number
}

const isPlayed = (f: Fixture) =>
  f.played && f.hg !== null && f.ag !== null && f.home !== null && f.away !== null

/** Matchday number of a league fixture (1-based). */
export const matchdayOf = (f: Fixture) => (f.roundIndex ?? 0) + 1

export function matchdayCount(fixtures: Fixture[]): number {
  return fixtures.reduce((m, f) => Math.max(m, matchdayOf(f)), 0)
}

interface Acc {
  row: TableRow
  results: { date: string; outcome: Outcome }[]
}

function tally(
  fixtures: Fixture[],
  venue: Venue,
  clubs: Map<number, { name: string; short: string }>,
) {
  const acc = new Map<number, Acc>()
  for (const [club, n] of clubs)
    acc.set(club, {
      row: {
        club,
        name: n.name,
        short: n.short,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
        form: [],
        position: 0,
      },
      results: [],
    })
  for (const f of fixtures) {
    if (!isPlayed(f)) continue
    const sides: [number, number, number, boolean][] = [
      [f.home!, f.hg!, f.ag!, true],
      [f.away!, f.ag!, f.hg!, false],
    ]
    for (const [club, gf, ga, home] of sides) {
      if (venue === 'home' && !home) continue
      if (venue === 'away' && home) continue
      const a = acc.get(club)
      if (!a) continue
      const r = a.row
      r.played++
      r.gf += gf
      r.ga += ga
      const outcome: Outcome = gf > ga ? 'W' : gf === ga ? 'D' : 'L'
      if (outcome === 'W') {
        r.won++
        r.points += 3
      } else if (outcome === 'D') {
        r.drawn++
        r.points += 1
      } else r.lost++
      a.results.push({ date: f.date ?? '', outcome })
    }
  }
  for (const a of acc.values()) {
    a.row.gd = a.row.gf - a.row.ga
    a.row.form = a.results
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(-5)
      .map((x) => x.outcome)
  }
  return [...acc.values()].map((a) => a.row)
}

/** Points and goal difference of each team in the games between `group` only. */
function headToHead(fixtures: Fixture[], group: Set<number>) {
  const h = new Map<number, { points: number; gd: number }>()
  for (const c of group) h.set(c, { points: 0, gd: 0 })
  for (const f of fixtures) {
    if (!isPlayed(f) || !group.has(f.home!) || !group.has(f.away!)) continue
    const home = h.get(f.home!)!
    const away = h.get(f.away!)!
    home.gd += f.hg! - f.ag!
    away.gd += f.ag! - f.hg!
    if (f.hg! > f.ag!) home.points += 3
    else if (f.hg! < f.ag!) away.points += 3
    else {
      home.points++
      away.points++
    }
  }
  return h
}

function sortRows(rows: TableRow[], fixtures: Fixture[]): TableRow[] {
  const byPoints = new Map<number, TableRow[]>()
  for (const r of rows) byPoints.set(r.points, [...(byPoints.get(r.points) ?? []), r])
  const sorted: TableRow[] = []
  for (const points of [...byPoints.keys()].sort((a, b) => b - a)) {
    const group = byPoints.get(points)!
    const h2h = group.length > 1 ? headToHead(fixtures, new Set(group.map((r) => r.club))) : null
    group.sort((a, b) => {
      if (h2h) {
        const ha = h2h.get(a.club)!
        const hb = h2h.get(b.club)!
        if (hb.points !== ha.points) return hb.points - ha.points
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
      }
      return b.gd - a.gd || b.gf - a.gf || a.short.localeCompare(b.short)
    })
    sorted.push(...group)
  }
  sorted.forEach((r, i) => (r.position = i + 1))
  return sorted
}

/** Every club in the competition, with its names. */
export function clubsOf(fixtures: Fixture[]) {
  const clubs = new Map<number, { name: string; short: string }>()
  for (const f of fixtures) {
    if (f.home !== null)
      clubs.set(f.home, { name: f.homeName ?? '?', short: f.homeShort ?? f.homeName ?? '?' })
    if (f.away !== null)
      clubs.set(f.away, { name: f.awayName ?? '?', short: f.awayShort ?? f.awayName ?? '?' })
  }
  return clubs
}

/** The table after `matchday` (all played games when null). */
export function leagueTable(
  fixtures: Fixture[],
  opts: { matchday?: number | null; venue?: Venue } = {},
): TableRow[] {
  const upTo = opts.matchday ?? Infinity
  const used = fixtures.filter((f) => matchdayOf(f) <= upTo)
  const venue = opts.venue ?? 'all'
  const rows = tally(used, venue, clubsOf(fixtures))
  // Head-to-head uses the games of the same venue view
  const h2hGames = used.filter((f) => isPlayed(f))
  return sortRows(rows, h2hGames)
}

/** Last matchday with at least one result. */
export function lastPlayedMatchday(fixtures: Fixture[]): number {
  return fixtures.filter(isPlayed).reduce((m, f) => Math.max(m, matchdayOf(f)), 0)
}

/** Position of every club after each matchday 1…n. */
export function positionsByMatchday(fixtures: Fixture[]): Map<number, number[]> {
  const out = new Map<number, number[]>()
  const last = lastPlayedMatchday(fixtures)
  for (let md = 1; md <= last; md++)
    for (const r of leagueTable(fixtures, { matchday: md }))
      out.set(r.club, [...(out.get(r.club) ?? []), r.position])
  return out
}

/** "9 of 380 games played". */
export function matchCountLabel(fixtures: Fixture[]): string {
  return `${fixtures.filter(isPlayed).length} of ${fixtures.length} games played.`
}
