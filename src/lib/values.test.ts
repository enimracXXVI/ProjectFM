import { describe, expect, it } from 'vitest'
import { sortValue } from './values'

describe('sortValue', () => {
  it('reads money with units', () => {
    expect(sortValue('€2.69M p/a')).toBe(2_690_000)
    expect(sortValue('€13.25K p/a')).toBe(13_250)
    expect(sortValue('€80,000,000')).toBe(80_000_000)
  })

  it('uses the midpoint of a range', () => {
    expect(sortValue('€650K - €1.5M')).toBe(1_075_000)
  })

  it('reads dates, percentages and decimals', () => {
    expect(sortValue('30/6/2028')).toBe(Date.UTC(2028, 5, 30))
    expect(sortValue('45%')).toBe(45)
    expect(sortValue('0.35')).toBe(0.35)
  })

  it('returns null for empty values and text', () => {
    expect(sortValue('-')).toBeNull()
    expect(sortValue('Full Time')).toBeNull()
    expect(sortValue(undefined)).toBeNull()
  })
})
