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
import { knowledgeMins, labelKnowledge } from './knowledge'
import { DEFAULT_TRAIT_NAMES } from '../data/traits'

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
  /** Role numbers from the save that match no role in Settings > Roles, with where they are. */
  codes: { code: string; phase: 'ip' | 'oop'; position: string | null }[]
}

export interface UnknownTrait {
  bit: number
  /** Squad players with the trait, with the traits of theirs the app can already name. */
  players: {
    name: string
    /** His traits in FM's order: a name, "this" for this trait, or null for another unnamed one. */
    order: (string | null)[]
    unknown: number
  }[]
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
  traits: UnknownTrait[]
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
  const kMins = config
    ? knowledgeMins(config.knowledgeLevels, config.knowledgeMins, config.learned.knowledge)
    : []
  const knowledge = group(
    staff.flatMap((s) =>
      s.knowledge.map(
        (k) =>
          [
            config ? labelKnowledge(k.level, config.knowledgeLevels, kMins) : k.level,
            `${s.name} – ${k.nation}`,
          ] as [string, string],
      ),
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
      codes: t.slots.flatMap((s) => [
        ...(s.unknownRole
          ? [{ code: s.unknownRole, phase: 'ip' as const, position: s.position }]
          : []),
        ...(s.unknownRoleOop
          ? [
              {
                code: s.unknownRoleOop,
                phase: 'oop' as const,
                position: s.positionOop ?? s.position,
              },
            ]
          : []),
      ]),
    }))
    .filter((t) => t.codes.length > 0)
  const jobMap = new Map<number, string[]>()
  for (const s of staff)
    if (s.job_code != null && s.role === `Job ${s.job_code}`)
      jobMap.set(s.job_code, [...(jobMap.get(s.job_code) ?? []), s.name])
  const jobs = [...jobMap.entries()].map(([code, names]) => ({ code, names }))
  // Trait numbers from the save that have no name yet
  const names = { ...DEFAULT_TRAIT_NAMES, ...config?.traitNames }
  const traitMap = new Map<number, UnknownTrait['players']>()
  for (const p of squad) {
    const bits = (p.extra.Traits ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b)
    const unknownBits = bits.filter((b) => !names[String(b)])
    for (const b of unknownBits)
      traitMap.set(b, [
        ...(traitMap.get(b) ?? []),
        {
          name: p.name,
          order: bits.map((x) => (x === b ? 'this' : (names[String(x)] ?? null))),
          unknown: unknownBits.length,
        },
      ])
  }
  const traits = [...traitMap.entries()]
    .sort((a, b) => a[0] - b[0])
    // Players with only this one unnamed trait first: their FM screen names it directly
    .map(([bit, players]) => ({ bit, players: players.sort((a, b) => a.unknown - b.unknown) }))
  return {
    jobs,
    traits,
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
      tactics.reduce((n, t) => n + t.codes.length, 0) +
      jobs.length +
      traits.length,
  }
}
