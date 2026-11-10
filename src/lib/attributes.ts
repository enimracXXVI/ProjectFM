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
