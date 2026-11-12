import { describe, expect, it } from 'vitest'
import { DEFAULT_PERSONALITY_RULES, personalityName } from '../lib/personality'
import { applyImportWords, DEFAULT_FOOT_MINS, DEFAULT_FOOT_WORDS, footWithValue } from './dump'

const words = {
  personalityRules: DEFAULT_PERSONALITY_RULES,
  footWords: DEFAULT_FOOT_WORDS,
  footMins: DEFAULT_FOOT_MINS,
}

describe('Settings words at import', () => {
  it('keeps the default foot words', () => {
    expect(footWithValue(20)).toBe('Very Strong (20)')
    expect(footWithValue(9)).toBe('Reasonable (9)')
    expect(footWithValue(4)).toBe('Very Weak (4)')
  })

  it('relabels feet and personality with edited rules', () => {
    const p = {
      name: 'Test',
      left_foot: 'Strong (16)',
      right_foot: 'Weak (6)',
      personality: 'Old',
      attributes: { Determination: 20, Leadership: 10 },
      extra: {
        Professionalism: '20',
        Pressure: '10',
        Ambition: '10',
        Temperament: '10',
        Loyalty: '10',
        Sportsmanship: '10',
      },
    } as unknown as Parameters<typeof applyImportWords>[0]
    const expected = personalityName({
      professionalism: 20,
      pressure: 10,
      ambition: 10,
      temperament: 10,
      loyalty: 10,
      sportsmanship: 10,
      determination: 20,
      leadership: 10,
    })
    expect(applyImportWords(p, words).personality).toBe(expected)

    const custom = {
      personalityRules: [
        {
          name: 'Custom',
          ranges: [[18, 20], null, null, null, null, null, null, null] as (
            [number, number] | null
          )[],
        },
      ],
      footWords: ['Bad', 'Good'],
      footMins: [1, 10],
    }
    const out = applyImportWords(p, custom)
    expect(out.personality).toBe('Custom')
    expect(out.left_foot).toBe('Good (16)')
    expect(out.right_foot).toBe('Bad (6)')
  })
})
