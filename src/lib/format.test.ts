import { describe, expect, it } from 'vitest'
import { formatMoney, formatWage } from './format'

describe('formatMoney', () => {
  it('formats millions compactly', () => {
    expect(formatMoney(12_500_000)).toBe('€12.5M')
  })

  it('formats thousands compactly', () => {
    expect(formatMoney(4_000)).toBe('€4K')
  })
})

describe('formatWage', () => {
  it('appends per-week suffix', () => {
    expect(formatWage(45_000)).toBe('€45K p/w')
  })
})

describe('formatMoney edge cases', () => {
  it('handles small, billion and negative values', () => {
    expect(formatMoney(950)).toBe('€950')
    expect(formatMoney(1_250_000_000)).toBe('€1.3B')
    expect(formatMoney(-2_000_000)).toBe('-€2M')
  })
})
