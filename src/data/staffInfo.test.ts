import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KNOWLEDGE_LEVELS,
  DEFAULT_STAFF_SCALE,
  STAFF_SCALE_RANGES,
  ratingColor,
} from './staffInfo'

describe('staff rating scale', () => {
  it('runs from Unsuited to Elite with a range for every word', () => {
    expect(DEFAULT_STAFF_SCALE[0]).toBe('Unsuited')
    expect(DEFAULT_STAFF_SCALE.at(-1)).toBe('Elite')
    for (const w of DEFAULT_STAFF_SCALE) expect(STAFF_SCALE_RANGES[w], w).toBeTruthy()
  })

  it('colours by position on the scale', () => {
    expect(ratingColor('Elite', DEFAULT_STAFF_SCALE)).toBe('text-emerald-400')
    expect(ratingColor('Unsuited', DEFAULT_STAFF_SCALE)).toBe('text-red-400')
  })

  it('lists knowledge from Minimal to Complete', () => {
    expect(DEFAULT_KNOWLEDGE_LEVELS[0]).toBe('Minimal')
    expect(DEFAULT_KNOWLEDGE_LEVELS.at(-1)).toBe('Complete')
  })
})

describe('scale with values', async () => {
  const { scaleWord, scaleRanges, DEFAULT_STAFF_SCALE_MIN } = await import('./staffInfo')
  it('turns values into words and ranges', () => {
    expect(
      [1, 4, 9, 10, 14, 17, 19, 20].map((n) =>
        scaleWord(n, DEFAULT_STAFF_SCALE, DEFAULT_STAFF_SCALE_MIN),
      ),
    ).toEqual([
      'Unsuited',
      'Reasonable',
      'Competent',
      'Average',
      'Good',
      'Very Good',
      'Outstanding',
      'Elite',
    ])
    expect(scaleRanges(DEFAULT_STAFF_SCALE_MIN)).toEqual([
      '0–3',
      '4–6',
      '7–9',
      '10–11',
      '12–14',
      '15–17',
      '18–19',
      '20',
    ])
  })
})
