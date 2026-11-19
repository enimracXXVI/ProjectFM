/**
 * Scouting knowledge: the save stores a number (0–100), FM shows a level word. Each level
 * covers a range, from its lowest value up to the next level's; the lowest values come from
 * what was seen in FM (Settings > Staff ratings), and can be set by hand.
 */
import { KNOWLEDGE_WORDS } from '../import/save'
import { valueOf, withValue } from './valueWord'

/** Values checked in FM, with the level FM showed: built in, plus what the user taught. */
export function knownKnowledge(learned: Record<string, string> | undefined): [number, string][] {
  return Object.entries({ ...KNOWLEDGE_WORDS, ...learned })
    .map(([v, w]) => [Number(v), w] as [number, string])
    .filter(([v, w]) => Number.isFinite(v) && !!w)
    .sort((a, b) => a[0] - b[0])
}

/**
 * The lowest value of each level (same order as the levels). Saved values are used when
 * there is one per level; otherwise each level starts at the lowest value seen with it in FM
 * (the first level at 0), and a level never seen has none (null).
 */
export function knowledgeMins(
  levels: string[],
  saved: (number | null)[] | undefined,
  learned: Record<string, string> | undefined,
): (number | null)[] {
  if (saved && saved.length === levels.length) return saved
  const known = knownKnowledge(learned)
  return levels.map((l, i) => {
    if (i === 0) return 0
    const seen = known.filter(([, w]) => w === l).map(([v]) => v)
    return seen.length ? Math.min(...seen) : null
  })
}

/** The level for a value: the highest level whose range starts at or below it. */
export function knowledgeLevel(
  n: number,
  levels: string[],
  mins: (number | null)[],
): string | null {
  let out: string | null = null
  levels.forEach((l, i) => {
    const m = mins[i]
    if (m !== null && m !== undefined && m <= n) out = l
  })
  return out
}

/** "Unknown (12)" or "Basic (12)" → the level the ranges give for 12 (unchanged without a value). */
export function labelKnowledge(text: string, levels: string[], mins: (number | null)[]): string {
  const n = valueOf(text)
  if (n === null) return text
  const word = knowledgeLevel(n, levels, mins)
  return word ? withValue(word, n) : text
}
