import { describe, expect, it } from 'vitest'
import { attrColor, attrNumber, formatAttr } from './attributes'

describe('attribute helpers', () => {
  it('formats single values and ranges', () => {
    expect(formatAttr(14)).toBe('14')
    expect(formatAttr([11, 14])).toBe('11-14')
    expect(formatAttr(undefined)).toBe('–')
  })

  it('uses range midpoint as number', () => {
    expect(attrNumber([10, 14])).toBe(12)
    expect(attrNumber(undefined)).toBeNull()
  })

  it('colours by FM scale', () => {
    expect(attrColor(18)).toBe('text-emerald-400')
    expect(attrColor(3)).toBe('text-red-400')
  })
})
