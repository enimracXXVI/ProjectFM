/**
 * What the app could not work out, for the user to look up in FM: values with no known
 * word yet ("Unknown (n)") and squad players whose personality fits no known rule.
 */
import type { PlayerRow, StaffRow } from '../data/db'
import { UNKNOWN_WORD, valueOf, wordOf } from './valueWord'

export interface UnknownValue {
  value: number
  /** Where it shows: player names, or "Scout – Nation". */
  where: string[]
}

export interface Checks {
  morale: UnknownValue[]
  knowledge: UnknownValue[]
  personality: PlayerRow[]
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

export function findChecks(players: PlayerRow[], staff: StaffRow[]): Checks {
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
  return {
    morale,
    knowledge,
    personality,
    total: morale.length + knowledge.length + personality.length,
  }
}
