import { describe, expect, it, vi } from 'vitest'
import type { ImportedPlayer } from '../import/types'
import { mergePlayer } from './api'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const base: ImportedPlayer = {
  fm_uid: 1,
  name: 'Pote',
  positions: 'M (C)',
  squad_number: 28,
  age: 28,
  nation: 'Portugal',
  second_nation: null,
  height_cm: 173,
  left_foot: 'Fairly Strong',
  right_foot: 'Very Strong',
  personality: 'Spirited',
  attributes: { Pace: 12, Flair: 14 },
  extra: { status: 'Inj', selection: 'S1' },
}

describe('mergePlayer', () => {
  const existing = { ...base, id: 'p1', in_squad: true }

  it('keeps stored attributes and fields a stats view does not contain', () => {
    const stats: ImportedPlayer = {
      ...base,
      positions: null,
      squad_number: null,
      age: 29,
      height_cm: null,
      left_foot: null,
      right_foot: null,
      personality: null,
      nation: null,
      attributes: {},
      extra: { Gls: '7' },
    }
    const merged = mergePlayer(existing, stats, {
      core: new Set(['fm_uid', 'name', 'age']),
      attributes: new Set(),
      extra: new Set(['Gls']),
    })
    expect(merged.attributes).toEqual({ Pace: 12, Flair: 14 })
    expect(merged.positions).toBe('M (C)')
    expect(merged.age).toBe(29)
    expect(merged.extra).toEqual({ status: 'Inj', selection: 'S1', Gls: '7' })
  })

  it('clears values whose column is in the file but empty', () => {
    const healed: ImportedPlayer = { ...base, squad_number: null, extra: { selection: 'S1' } }
    const merged = mergePlayer(existing, healed, {
      core: new Set(['fm_uid', 'name', 'squad_number']),
      attributes: new Set(['Pace', 'Flair']),
      extra: new Set(['status', 'selection']),
    })
    expect(merged.squad_number).toBeNull()
    expect(merged.extra).toEqual({ selection: 'S1' })
  })
})
