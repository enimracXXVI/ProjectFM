import { describe, expect, it } from 'vitest'
import type { PositionCode } from '../tactics/types'
import { formationName } from './formation'

const xi = (s: string) => s.split(' ') as PositionCode[]

describe('formations from positions', () => {
  it('names FM formations', () => {
    // Atalanta and Fiorentina, 6 Sep 2026
    expect(formationName(xi('GK DR DC DC DL DM MC MC AMR AML ST'))).toBe('4-1-2-2-1 (DM, wide AMs)')
    expect(formationName(xi('GK WBR DC DC WBL DM MC MC AMR AML ST'))).toBe('4-1-2-2-1')
  })

  it('needs a full eleven', () => {
    expect(formationName(xi('GK DC DC'))).toBeNull()
  })
})
