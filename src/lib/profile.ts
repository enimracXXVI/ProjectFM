import { footWord } from '../import/dump'
import { parsePositions } from './roleFit'
import { valueOf, wordOf } from './valueWord'

/** Where each FM position sits on the small profile pitch (x, y in %, attack at the top). */
export const PITCH_SPOTS: Record<string, [number, number]> = {
  ST: [50, 10],
  AML: [15, 27],
  AMC: [50, 27],
  AMR: [85, 27],
  ML: [12, 44],
  MC: [50, 44],
  MR: [88, 44],
  WBL: [12, 60],
  DM: [50, 60],
  WBR: [88, 60],
  DL: [15, 75],
  DC: [50, 75],
  DR: [85, 75],
  SW: [50, 84],
  GK: [50, 93],
}

/** FM position text ("D/WB (L), M (C)") as pitch spots: DL, WBL, MC. */
export function pitchSpots(positions: string | null | undefined): string[] {
  const out = parsePositions(positions).map((p) => {
    const m = p.match(/^([A-Z]+)(?: \(([RLC])\))?$/)
    if (!m) return null
    const [, base, side] = m
    if (base === 'GK' || base === 'DM' || base === 'SW') return base
    if (base === 'ST') return 'ST'
    if (base === 'D') return `D${side ?? 'C'}`
    if (base === 'WB') return side === 'R' ? 'WBR' : side === 'L' ? 'WBL' : null
    return `${base}${side ?? 'C'}`
  })
  return [...new Set(out.filter((s): s is string => !!s && s in PITCH_SPOTS))]
}

/**
 * A foot's strength as a step on the foot-word scale: "Strong (16)" or 16 → 5 of 6.
 * Words without a number ("Strong") are found in the list. Null when unknown.
 */
export function footLevel(
  foot: string | number | null | undefined,
  words: string[],
  mins: number[],
): { level: number; of: number; word: string } | null {
  if (foot === null || foot === undefined || foot === '') return null
  const n = typeof foot === 'number' ? foot : valueOf(foot)
  const word =
    n !== null && n > 0
      ? footWord(n, words, mins)
      : (words.find((w) => w.toLowerCase() === wordOf(String(foot)).toLowerCase()) ?? null)
  if (!word) return null
  const i = words.indexOf(word)
  return i < 0 ? null : { level: i + 1, of: words.length, word }
}

/** Colour of a foot meter: green for the strong foot, orange/red for a weak one. */
export function footColor(level: number, of: number): string {
  const f = level / of
  if (f >= 0.8) return 'bg-emerald-400'
  if (f >= 0.65) return 'bg-lime-300'
  if (f >= 0.45) return 'bg-orange-400'
  return 'bg-red-400'
}
export function footTextColor(level: number, of: number): string {
  return footColor(level, of).replace('bg-', 'text-')
}
