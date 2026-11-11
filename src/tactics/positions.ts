import type { PositionCode } from './types'

/** FM's position text, as roles use it. */
export const POSITION_TEXT: Record<PositionCode, string> = {
  GK: 'GK',
  DL: 'D (L)',
  DC: 'D (C)',
  DR: 'D (R)',
  WBL: 'WB (L)',
  WBR: 'WB (R)',
  DM: 'DM',
  ML: 'M (L)',
  MC: 'M (C)',
  MR: 'M (R)',
  AML: 'AM (L)',
  AMC: 'AM (C)',
  AMR: 'AM (R)',
  ST: 'ST (C)',
}

export const POSITION_CODES = Object.keys(POSITION_TEXT) as PositionCode[]

/** Row on the pitch (0 = own goal line, 1 = opponent's) and default x for each position. */
const PLACE: Record<PositionCode, { y: number; x: number }> = {
  GK: { y: 0.06, x: 0.5 },
  DL: { y: 0.24, x: 0.12 },
  DC: { y: 0.22, x: 0.5 },
  DR: { y: 0.24, x: 0.88 },
  WBL: { y: 0.38, x: 0.1 },
  WBR: { y: 0.38, x: 0.9 },
  DM: { y: 0.38, x: 0.5 },
  ML: { y: 0.55, x: 0.12 },
  MC: { y: 0.53, x: 0.5 },
  MR: { y: 0.55, x: 0.88 },
  AML: { y: 0.72, x: 0.15 },
  AMC: { y: 0.7, x: 0.5 },
  AMR: { y: 0.72, x: 0.85 },
  ST: { y: 0.88, x: 0.5 },
}

/** Pitch coordinates (0–1) for each slot; central positions that repeat spread out. */
export function pitchPlaces(positions: (PositionCode | null)[]): { x: number; y: number }[] {
  const counts = new Map<PositionCode, number>()
  for (const p of positions) if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
  const seen = new Map<PositionCode, number>()
  return positions.map((p) => {
    if (!p) return { x: 0.5, y: 0.5 }
    const n = counts.get(p)!
    const i = seen.get(p) ?? 0
    seen.set(p, i + 1)
    const base = PLACE[p]
    if (n === 1) return base
    const spread = n === 2 ? [0.36, 0.64] : n === 3 ? [0.25, 0.5, 0.75] : [0.2, 0.4, 0.6, 0.8]
    return { x: spread[i] ?? base.x, y: base.y }
  })
}

/** Formation label, e.g. "4-1-2-2-1", from the slots (defenders first). */
export function formationLabel(positions: (PositionCode | null)[]): string {
  const rows: [PositionCode[], number][] = [
    [['DL', 'DC', 'DR'], 0],
    [['WBL', 'WBR', 'DM'], 0],
    [['ML', 'MC', 'MR'], 0],
    [['AML', 'AMC', 'AMR'], 0],
    [['ST'], 0],
  ]
  for (const p of positions) for (const r of rows) if (p && r[0].includes(p)) r[1]++
  // Wing-backs count with the defence line when there is no full-back on that side
  return rows
    .map((r) => r[1])
    .filter((n) => n > 0)
    .join('-')
}

/** Common formations to pick from (opponents, or a new tactic). */
export const FORMATIONS: Record<string, PositionCode[]> = {
  '4-4-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'],
  '4-3-3': ['GK', 'DR', 'DC', 'DC', 'DL', 'MC', 'MC', 'MC', 'AMR', 'AML', 'ST'],
  '4-2-3-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'DM', 'AMR', 'AMC', 'AML', 'ST'],
  '4-1-2-2-1 (DM, wide AMs)': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'MC', 'AMR', 'AML', 'ST'],
  '4-1-4-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MR', 'MC', 'MC', 'ML', 'ST'],
  '4-3-1-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MC', 'MC', 'MC', 'AMC', 'ST', 'ST'],
  '4-2-2-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'DM', 'AMR', 'AML', 'ST', 'ST'],
  '4-4-1-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'AMC', 'ST'],
  '4-5-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'MC', 'ML', 'ST'],
  '3-5-2': ['GK', 'DC', 'DC', 'DC', 'WBR', 'WBL', 'DM', 'MC', 'MC', 'ST', 'ST'],
  '3-4-3': ['GK', 'DC', 'DC', 'DC', 'MR', 'MC', 'MC', 'ML', 'AMR', 'AML', 'ST'],
  '3-4-2-1': ['GK', 'DC', 'DC', 'DC', 'WBR', 'MC', 'MC', 'WBL', 'AMR', 'AML', 'ST'],
  '5-3-2': ['GK', 'WBR', 'DC', 'DC', 'DC', 'WBL', 'MC', 'MC', 'MC', 'ST', 'ST'],
  '5-2-3': ['GK', 'WBR', 'DC', 'DC', 'DC', 'WBL', 'MC', 'MC', 'AMR', 'AML', 'ST'],
  '5-4-1': ['GK', 'WBR', 'DC', 'DC', 'DC', 'WBL', 'MR', 'MC', 'MC', 'ML', 'ST'],
}
