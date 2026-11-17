import { describe, expect, it } from 'vitest'
import { DEFAULT_FOOT_MINS, DEFAULT_FOOT_WORDS } from '../import/dump'
import { footLevel, pitchSpots } from './profile'

describe('profile pitch', () => {
  it('turns FM position text into pitch spots', () => {
    expect(pitchSpots('M/AM (C)')).toEqual(['MC', 'AMC'])
    expect(pitchSpots('D/WB (RL), DM')).toEqual(['DR', 'DL', 'WBR', 'WBL', 'DM'])
    expect(pitchSpots('GK')).toEqual(['GK'])
    expect(pitchSpots('AM (RL), ST (C)')).toEqual(['AMR', 'AML', 'ST'])
    expect(pitchSpots('D (C)')).toEqual(['DC'])
  })
})

describe('foot level', () => {
  const w = DEFAULT_FOOT_WORDS
  const m = DEFAULT_FOOT_MINS
  it('reads stored words with values, plain words and numbers', () => {
    expect(footLevel('Very Strong (20)', w, m)).toEqual({ level: 6, of: 6, word: 'Very Strong' })
    expect(footLevel('Reasonable', w, m)).toEqual({ level: 3, of: 6, word: 'Reasonable' })
    expect(footLevel('Strong', w, m)?.level).toBe(5)
    expect(footLevel(5, w, m)?.word).toBe('Weak')
    expect(footLevel(null, w, m)).toBeNull()
  })
})
