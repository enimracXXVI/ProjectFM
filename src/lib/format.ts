const UNITS: [number, string][] = [
  [1_000_000_000, 'B'],
  [1_000_000, 'M'],
  [1_000, 'K'],
]

function compact(value: number): string {
  const abs = Math.abs(value)
  for (const [size, suffix] of UNITS) {
    if (abs >= size) {
      // One decimal, trailing ".0" dropped: 12.5M, 4K
      const n = Math.round((value / size) * 10) / 10
      return `${n}${suffix}`
    }
  }
  return String(Math.round(value))
}

/**
 * Formats money compactly in FM style, e.g. 12_500_000 -> "€12.5M".
 * Hand-rolled instead of Intl compact notation, whose output differs between browsers.
 */
export function formatMoney(value: number, symbol = '€'): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}${symbol}${compact(Math.abs(value))}`
}

/** Formats a weekly wage, e.g. 45_000 -> "€45K p/w". */
export function formatWage(value: number, symbol = '€'): string {
  return `${formatMoney(value, symbol)} p/w`
}
