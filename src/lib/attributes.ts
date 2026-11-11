import type { AttributeValue } from '../import/parse'

export function formatAttr(v: AttributeValue | undefined): string {
  if (v === undefined) return '–'
  return Array.isArray(v) ? `${v[0]}-${v[1]}` : String(v)
}

/** Single number for sorting/comparison; ranges use their midpoint. */
export function attrNumber(v: AttributeValue | undefined): number | null {
  if (v === undefined) return null
  return Array.isArray(v) ? (v[0] + v[1]) / 2 : v
}

/** Text colour class for a 1–20 attribute, similar to FM's scale. */
export function attrColor(v: AttributeValue | undefined): string {
  const n = attrNumber(v)
  if (n === null) return 'text-muted'
  if (n >= 16) return 'text-emerald-400'
  if (n >= 13) return 'text-lime-300'
  if (n >= 10) return 'text-text'
  if (n >= 6) return 'text-amber-400'
  return 'text-red-400'
}

/** Hidden values where a high number is bad (coloured the other way round). */
export const HIGH_IS_BAD = new Set(['Dirtiness', 'Injury Proneness', 'Controversy'])

/** Colour for a 1–20 value by name: hidden "bad" values are inverted. */
export function valueColor(name: string, v: AttributeValue | undefined): string {
  const n = attrNumber(v)
  if (n === null) return 'text-muted'
  return attrColor(HIGH_IS_BAD.has(name) ? 21 - n : n)
}

/** A 0–100 score on the 1–20 attribute scale (0 → 1, 100 → 20), for the same colours. */
export const scoreAsAttr = (score: number) => 1 + (score / 100) * 19

/** Text colour for a 0–100 score (role fit), matching the attribute colours. */
export const scoreTextColor = (score: number) => attrColor(scoreAsAttr(score))

/** Bar colour for a 0–100 score, matching the attribute colours. */
export function scoreBarColor(score: number): string {
  const n = scoreAsAttr(score)
  if (n >= 16) return 'bg-emerald-400'
  if (n >= 13) return 'bg-lime-300'
  if (n >= 10) return 'bg-slate-300'
  if (n >= 6) return 'bg-amber-400'
  return 'bg-red-400'
}

/** Position ratings (1–20) from the import: "GK:1 DC:20 …" → { GK: 1, DC: 20 }. */
export function parsePositionRatings(text: string | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const part of (text ?? '').split(/\s+/)) {
    const [k, v] = part.split(':')
    if (k && v && !Number.isNaN(Number(v))) out[k] = Number(v)
  }
  return out
}
