/**
 * FM stores money in pounds. Your FM shows euros; the rate below was measured from your
 * exports: for all 17 non-loan first-team players, yearly € wage = weekly £ × 52 × 1.1641.
 */
export const EUR_PER_GBP = 1.1641

const compact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${Math.round(v / 1e8) / 10}B`
  if (a >= 1e6) return `${Math.round(v / 1e5) / 10}M`
  if (a >= 1e3) return `${Math.round(v / 100) / 10}K`
  return String(Math.round(v))
}

/** £ amount from the dump as € text, e.g. 92_700_000 → "€107.9M". */
export function eur(gbp: number | null | undefined): string {
  return gbp == null ? '–' : `€${compact(gbp * EUR_PER_GBP)}`
}

/** Weekly £ wage from the dump as FM's yearly € text, e.g. 4625 → "€280K p/a". */
export function eurWagePerYear(gbpPerWeek: number | null | undefined): string {
  return gbpPerWeek == null ? '–' : `€${compact(gbpPerWeek * 52 * EUR_PER_GBP)} p/a`
}
