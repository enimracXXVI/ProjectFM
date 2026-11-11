import { describe, expect, it } from 'vitest'
import { eur, eurWagePerYear } from './money'

describe('money', () => {
  it('converts dump wages to FM yearly euros', () => {
    // Values from the user's dump and contract export
    expect(eurWagePerYear(4625)).toBe('€280K p/a') // Luca Lezzerini
    expect(eurWagePerYear(91850)).toBe('€5.6M p/a') // David De Gea, €5.56M in FM
    expect(eurWagePerYear(189)).toBe('€11.4K p/a') // Victor de los Santos, €11.5K in FM
  })

  it('converts values', () => {
    expect(eur(1_000_000)).toBe('€1.2M')
    expect(eur(null)).toBe('–')
  })
})
