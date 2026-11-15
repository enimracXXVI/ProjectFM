/**
 * FM's height tables for Jumping Reach and Aerial Reach (tables.fmf in FM27's data): for each
 * height band, the attribute a player gets from a poor to a good leap. A player's reach over
 * or under that range shows how much more (or less) he gets off the ground than his height
 * alone gives.
 */
import data from '../data/fm-reach.json'

/** [up to height cm, poor, below average, average, above average, good]. */
type Row = [number, number, number, number, number, number]
const TABLES = data as Record<'jumping' | 'aerial', Record<'male' | 'female', Row[]>>

export const REACH_BANDS = ['poor', 'below average', 'average', 'above average', 'good'] as const

/** FM's reach values for a height, poor to good (the last band for taller players). */
export function reachForHeight(
  kind: 'jumping' | 'aerial',
  heightCm: number,
  gender: 'male' | 'female' = 'male',
): number[] | null {
  const rows = TABLES[kind][gender]
  if (!rows.length || !heightCm) return null
  const row = rows.find((r) => heightCm <= r[0]) ?? rows[rows.length - 1]
  return row.slice(1)
}

/** Where a reach value sits for the height: the band it matches, or above / below them all. */
export function reachBand(value: number, range: number[]) {
  if (value > range[range.length - 1]) return 'above the range'
  if (value < range[0]) return 'below the range'
  const i = range.lastIndexOf(value)
  if (i >= 0) return REACH_BANDS[i]
  // Between two bands
  const k = range.findIndex((r) => r > value)
  return `between ${REACH_BANDS[k - 1]} and ${REACH_BANDS[k]}`
}
