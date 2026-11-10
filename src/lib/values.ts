const UNIT: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 }

/** One number from FM text: "€2.69M p/a" → 2690000, "45%" → 45, "1,234" → 1234. */
function single(text: string): number | null {
  const m = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const unit = text
    .slice((m.index ?? 0) + m[0].length)
    .trim()[0]
    ?.toUpperCase()
  return parseFloat(m[0]) * (UNIT[unit] ?? 1)
}

/**
 * Sortable number for any FM cell text.
 * Dates (d/m/yyyy) become timestamps; ranges ("€650K - €1.5M") use their midpoint.
 */
export function sortValue(text: string | undefined | null): number | null {
  if (!text) return null
  const t = text.trim()
  if (t === '' || t === '-') return null
  const date = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (date) return Date.UTC(+date[3], +date[2] - 1, +date[1])
  const parts = t.split(/\s+-\s+/)
  if (parts.length === 2) {
    const [a, b] = parts.map(single)
    if (a !== null && b !== null) return (a + b) / 2
  }
  return single(t)
}
