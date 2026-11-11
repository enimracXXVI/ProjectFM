/**
 * Values that FM shows as a word but the save or reader holds as a number are stored as
 * both, "Very Good (17)", so the number can be checked against the word in the game.
 */
export const withValue = (word: string, value: number) => `${word} (${value})`

/** Word shown when the value is known but its FM word is not confirmed yet. */
export const UNKNOWN_WORD = 'Unknown'

/** "Very Good (17)" → "Very Good"; a plain word is returned as it is. */
export const wordOf = (s: string) => s.replace(/\s*\(\d+\)$/, '')

/** "Very Good (17)" → 17; null when there is no value. */
export function valueOf(s: string): number | null {
  const m = s.match(/\((\d+)\)$/)
  return m ? Number(m[1]) : null
}

/** True when only the value is known ("Unknown (60)", or the older "60/100"). */
export const isUnknownWord = (s: string) => wordOf(s) === UNKNOWN_WORD || /^\d+\/\d+$/.test(s)
