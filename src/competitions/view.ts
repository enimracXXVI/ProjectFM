import type { AppConfig } from '../data/config'
import type {
  CompetitionInfo,
  CompetitionsFile,
  Fixture,
  PlayerMatch,
  SaveCompetition,
} from './types'

/** Name and type of a competition, or null when the user has not named it yet. */
export function compInfo(config: AppConfig, comp: SaveCompetition): CompetitionInfo | null {
  return comp.databaseId != null ? (config.competitions[String(comp.databaseId)] ?? null) : null
}

export const compLabel = (config: AppConfig, comp: SaveCompetition) =>
  compInfo(config, comp)?.name ?? `Competition ${comp.databaseId ?? comp.id}`

/** The first team's own fixtures in a competition. */
export function myFixtures(file: CompetitionsFile, comp: SaveCompetition): Fixture[] {
  return comp.fixtures.filter(
    (f) =>
      (f.home === file.club && (f.homeSlot ?? 0) === 0) ||
      (f.away === file.club && (f.awaySlot ?? 0) === 0),
  )
}

export const fixtureKey = (f: Fixture) => `${f.date}_${f.home}_${f.away}`

export const scoreText = (f: Fixture) =>
  f.played && f.hg !== null ? `${f.hg} – ${f.ag}` : (f.time ?? 'v')

/** Result for the club: W/D/L, or null when not played. */
export function resultFor(f: Fixture, club: number): 'W' | 'D' | 'L' | null {
  if (!f.played || f.hg === null || f.ag === null) return null
  const [mine, theirs] = f.home === club ? [f.hg, f.ag] : [f.ag, f.hg]
  return mine > theirs ? 'W' : mine === theirs ? 'D' : 'L'
}

export interface Tie {
  key: string
  a: { club: number | null; name: string }
  b: { club: number | null; name: string }
  legs: Fixture[]
  /** Aggregate goals for a and b over the played legs. */
  agg: [number, number] | null
}

export interface CupRound {
  stage: number | null
  code: number | null
  name: string
  /** Earliest date of the round. */
  date: string | null
  ties: Tie[]
}

/** A cup's rounds in order, each with its ties (one or two legs). */
export function cupRounds(comp: SaveCompetition, roundNames: Record<string, string>): CupRound[] {
  const byStage = new Map<number | null, Fixture[]>()
  for (const f of comp.fixtures) byStage.set(f.stage, [...(byStage.get(f.stage) ?? []), f])
  const rounds = [...byStage.entries()]
    .map(([stage, fx]) => ({ stage, fx, date: fx.map((f) => f.date ?? '').sort()[0] ?? null }))
    .sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))
  return rounds.map(({ stage, fx, date }, i) => {
    const code = fx[0]?.round ?? null
    const ties = new Map<string, Tie>()
    for (const f of fx) {
      const pair = [f.home, f.away].sort((x, y) => (x ?? 0) - (y ?? 0)).join('-')
      const tie = ties.get(pair) ?? {
        key: pair,
        a: { club: f.home, name: f.homeShort ?? f.homeName ?? '?' },
        b: { club: f.away, name: f.awayShort ?? f.awayName ?? '?' },
        legs: [],
        agg: null,
      }
      tie.legs.push(f)
      ties.set(pair, tie)
    }
    for (const tie of ties.values()) {
      const played = tie.legs.filter((l) => l.played && l.hg !== null)
      if (!played.length) continue
      tie.agg = played.reduce<[number, number]>(
        ([a, b], l) => (l.home === tie.a.club ? [a + l.hg!, b + l.ag!] : [a + l.ag!, b + l.hg!]),
        [0, 0],
      )
    }
    return {
      stage,
      code,
      name: (code !== null && roundNames[String(code)]) || `Round ${i + 1}`,
      date,
      ties: [...ties.values()],
    }
  })
}

export interface Leader {
  key: string
  name: string
  club: string | null
  apps: number
  goals: number
  assists: number
  rating: number | null
}

/** Per-player totals in a competition (from FM's per-match stats). */
export function leaders(file: CompetitionsFile, compId: number): Leader[] {
  const by = new Map<string, Leader & { ratingSum: number; rated: number }>()
  for (const m of file.playerMatches) {
    if (m.comp !== compId) continue
    const key = String(m.uniqueId ?? m.name)
    const l = by.get(key) ?? {
      key,
      name: m.name ?? '?',
      club: m.clubName,
      apps: 0,
      goals: 0,
      assists: 0,
      rating: null,
      ratingSum: 0,
      rated: 0,
    }
    l.apps++
    l.goals += m.goals ?? 0
    l.assists += m.assists ?? 0
    if (m.rating) {
      l.ratingSum += m.rating
      l.rated++
    }
    by.set(key, l)
  }
  return [...by.values()].map(({ ratingSum, rated, ...l }) => ({
    ...l,
    rating: rated ? Math.round((ratingSum / rated) * 100) / 100 : null,
  }))
}

/** Player lines of one match (both teams, as far as FM keeps them). */
export function matchLines(file: CompetitionsFile, compId: number, f: Fixture): PlayerMatch[] {
  return file.playerMatches.filter(
    (m) =>
      m.comp === compId && m.date === f.date && (m.opponent === f.home || m.opponent === f.away),
  )
}

export const seasonLabel = (year: number) => `${year}/${String((year + 1) % 100).padStart(2, '0')}`
