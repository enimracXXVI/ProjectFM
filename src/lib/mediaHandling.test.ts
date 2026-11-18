import { describe, expect, it } from 'vitest'
import { DEFAULT_MEDIA_RULES, MEDIA_FALLBACK, mediaHandling } from './mediaHandling'

const of = (o: Record<string, number>) => (label: string) => o[label]

describe('media handling', () => {
  it('matches the styles seen in FM27', () => {
    // Lapo Zipoli: Evasive, Reserved
    expect(
      mediaHandling(
        of({ Pressure: 15, Professionalism: 19, Temperament: 12, Controversy: 5 }),
        DEFAULT_MEDIA_RULES,
      ),
    ).toBe('Evasive, Reserved')
    // Marin Pongračić: Outspoken
    expect(
      mediaHandling(
        of({ Pressure: 10, Professionalism: 10, Temperament: 5, Controversy: 19 }),
        DEFAULT_MEDIA_RULES,
      ),
    ).toBe('Outspoken')
    // Arthur Atta: Level-headed (Loyalty 12: cannot be told from Media-friendly)
    expect(
      mediaHandling(
        of({ Pressure: 13, Professionalism: 15, Temperament: 13, Controversy: 6, Loyalty: 12 }),
        DEFAULT_MEDIA_RULES,
      ),
    ).toBe(MEDIA_FALLBACK)
    // Franco Mastantuono: Media-friendly (Loyalty 9: Level-headed needs 11+)
    expect(
      mediaHandling(
        of({ Pressure: 12, Professionalism: 14, Temperament: 12, Controversy: 6, Loyalty: 9 }),
        DEFAULT_MEDIA_RULES,
      ),
    ).toBe('Media-friendly')
    // Harry Amass: Unflappable, from one player only
    expect(
      mediaHandling(
        of({ Pressure: 15, Professionalism: 14, Temperament: 15, Controversy: 5 }),
        DEFAULT_MEDIA_RULES,
      ),
    ).toBe('Unflappable (?)')
  })

  it('gives nothing without the values', () => {
    expect(mediaHandling(() => undefined, DEFAULT_MEDIA_RULES)).toBeNull()
  })
})
