/**
 * FM's match data (simatch.fmf): how FM rates players by role, and how tactical training
 * adds up. Editable in Settings > FM match data.
 */
import data from './fm-match-data.json'
import type { RoleDef } from '../data/roles'

export interface MatchData {
  ratings: {
    /** Every player starts from this (6700 = 6.7). */
    start: number
    /**
     * [bit of the role's number, set] for in-possession roles. The entry FM stores after bit 29
     * reads as bit 63 (an 8-byte value); in the order of the list it is bit 31 (Channel Forward).
     */
    lookup: [number, number][]
    /** Points per event, by set (1000 = one rating point). */
    sets: [string, number][][]
  }
  training: {
    /** Share of tactical training each tactic gets (%). */
    split: { one: number; twoMain: number; twoOther: number; threeMain: number; threeOther: number }
    /** [coach attribute from, multiplier]. */
    coach: [number, number][]
    /** [player attribute from, multiplier]. */
    player: [number, number][]
    /** [weeks at the club from, multiplier]. */
    weeks: [number, number][]
  }
}

export const DEFAULT_MATCH_DATA = data as MatchData

/** The rating set FM uses for an in-possession role (by the role's number), if known. */
export function ratingSet(role: RoleDef | null | undefined, md: MatchData, mask: string) {
  if (!role?.fm?.code || role.phase !== 'ip') return null
  const code = BigInt(role.fm.code) & BigInt(mask)
  if (code === 0n || (code & (code - 1n)) !== 0n) return null
  const bit = code.toString(2).length - 1
  const index = md.ratings.lookup.find(([b]) => b === bit)?.[1]
  return index === undefined ? null : (md.ratings.sets[index] ?? null)
}

/** The multiplier of the band a value falls in (bands sorted by their start). */
export function band(bands: [number, number][], value: number): number | null {
  let out: number | null = null
  for (const [from, mult] of bands) if (value >= from) out = mult
  return out ?? bands[0]?.[1] ?? null
}
