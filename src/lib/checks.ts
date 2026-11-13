/**
 * What the app could not work out, for the user to look up in FM: values with no known
 * word yet ("Unknown (n)") and squad players whose personality fits no known rule.
 */
import type { CompetitionsFile } from '../competitions/types'
import { cupRounds } from '../competitions/view'
import type { AppConfig } from '../data/config'
import type { PlayerRow, StaffRow } from '../data/db'
import type { TacticRow } from '../tactics/types'
import { UNKNOWN_WORD, valueOf, wordOf } from './valueWord'

export interface UnknownValue {
  value: number
  /** Where it shows: player names, or "Scout – Nation". */
  where: string[]
}

export interface UnknownCompetition {
  databaseId: number
  /** A few of the club's fixtures, to recognise it. */
  examples: string[]
}

export interface UnknownRound {
  code: number
  competition: string
  date: string | null
  examples: string[]
}

export interface TacticCheck {
  name: string
  /** Role numbers from the save that match no role in Settings > Roles. */
  codes: string[]
}

export interface UnknownJob {
  code: number
  names: string[]
}

export interface Checks {
  morale: UnknownValue[]
  knowledge: UnknownValue[]
  personality: PlayerRow[]
  competitions: UnknownCompetition[]
  rounds: UnknownRound[]
  tactics: TacticCheck[]
  jobs: UnknownJob[]
  total: number
}

function group(items: [string, string][]): UnknownValue[] {
  const by = new Map<number, string[]>()
  for (const [text, where] of items) {
    if (wordOf(text) !== UNKNOWN_WORD) continue
    const n = valueOf(text)
    if (n === null) continue
    by.set(n, [...(by.get(n) ?? []), where])
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([value, where]) => ({ value, where }))
}

export function findChecks(
  players: PlayerRow[],
  staff: StaffRow[],
  comps?: CompetitionsFile,
  config?: AppConfig,
  tacticRows: TacticRow[] = [],
): Checks {
  const squad = players.filter((p) => p.in_squad)
  const morale = group(
    squad.flatMap((p) => (p.extra.Morale ? [[p.extra.Morale, p.name] as [string, string]] : [])),
  )
  const knowledge = group(
    staff.flatMap((s) =>
      s.knowledge.map((k) => [k.level, `${s.name} – ${k.nation}`] as [string, string]),
    ),
  )
  // Personality values were imported, but they fit no known personality
  const personality = squad.filter((p) => !p.personality && p.extra.Ambition !== undefined)
  const competitions: UnknownCompetition[] = []
  const rounds: UnknownRound[] = []
  if (comps && config) {
    for (const c of comps.competitions) {
      if (c.databaseId == null) continue
      const info = config.competitions[String(c.databaseId)]
      if (!info) {
        competitions.push({
          databaseId: c.databaseId,
          examples: c.fixtures
            .filter((f) => f.home === comps.club || f.away === comps.club)
            .slice(0, 3)
            .map((f) => `${f.date}: ${f.homeShort} – ${f.awayShort}`),
        })
        continue
      }
      if (info.kind !== 'cup') continue
      for (const r of cupRounds(c, config.learned.rounds ?? {})) {
        if (r.code === null || config.learned.rounds?.[String(r.code)]) continue
        if (rounds.some((x) => x.code === r.code)) continue
        rounds.push({
          code: r.code,
          competition: info.name,
          date: r.date,
          examples: r.ties.slice(0, 2).map((t) => `${t.a.name} – ${t.b.name}`),
        })
      }
    }
  }
  const tactics = tacticRows
    .filter((t) => t.save_index !== null)
    .map((t) => ({
      name: t.name,
      // Role numbers from the save that no role in Settings > Roles has
      codes: [
        ...new Set(t.slots.flatMap((s) => [s.unknownRole, s.unknownRoleOop]).filter(Boolean)),
      ] as string[],
    }))
    .filter((t) => t.codes.length > 0)
  const jobMap = new Map<number, string[]>()
  for (const s of staff)
    if (s.job_code != null && s.role === `Job ${s.job_code}`)
      jobMap.set(s.job_code, [...(jobMap.get(s.job_code) ?? []), s.name])
  const jobs = [...jobMap.entries()].map(([code, names]) => ({ code, names }))
  return {
    jobs,
    morale,
    knowledge,
    personality,
    competitions,
    rounds,
    tactics,
    total:
      morale.length +
      knowledge.length +
      personality.length +
      competitions.length +
      rounds.length +
      tactics.length +
      jobs.length,
  }
}
