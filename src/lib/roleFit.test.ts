import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_INFO } from '../data/attributeInfo'
import { DEFAULT_ROLES } from '../data/roles'
import fixture from '../import/fixtures/squad-attributes.json'
import type { AttributeValue } from '../import/types'
import { DEFAULT_ROLE_WEIGHTS as W, allRoleFits, parsePositions, roleScore } from './roleFit'

const role = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)!

describe('default roles', () => {
  it('has 79 FM27 roles using known attribute names', () => {
    expect(DEFAULT_ROLES).toHaveLength(79)
    for (const r of DEFAULT_ROLES) {
      for (const a of [...r.key, ...r.preferred])
        expect(ATTRIBUTE_INFO[a], `${r.id}: ${a}`).toBeDefined()
      expect(r.positions.length, r.id).toBeGreaterThan(0)
    }
  })
})

describe('parsePositions', () => {
  it('expands FM position text', () => {
    expect(parsePositions('D/WB (RL), M/AM (R)')).toEqual([
      'D (R)',
      'D (L)',
      'WB (R)',
      'WB (L)',
      'M (R)',
      'AM (R)',
    ])
    expect(parsePositions('DM, M (C)')).toEqual(['DM', 'M (C)'])
    expect(parsePositions('GK')).toEqual(['GK'])
    expect(parsePositions(null)).toEqual([])
  })
})

describe('roleScore', () => {
  it('scores 0 for all 1s and 100 for all 20s', () => {
    const r = role('p')
    const all = (v: number) => Object.fromEntries(Object.keys(ATTRIBUTE_INFO).map((a) => [a, v]))
    expect(roleScore(all(1), r, W)).toBe(0)
    expect(roleScore(all(20), r, W)).toBe(100)
  })

  it('rewards the role key attributes', () => {
    const base = Object.fromEntries(Object.keys(ATTRIBUTE_INFO).map((a) => [a, 10]))
    const poacher = { ...base, Finishing: 18, Heading: 17, 'Off The Ball': 17 }
    expect(roleScore(poacher, role('p'), W)!).toBeGreaterThan(roleScore(poacher, role('ccb'), W)!)
  })

  it('returns null without enough key attributes', () => {
    expect(roleScore({ Pace: 15 }, role('p'), W)).toBeNull()
  })

  it('ranks real squad players sensibly', () => {
    const players = fixture.players as {
      name: string
      positions: string | null
      attributes: Record<string, AttributeValue>
    }[]
    const fit = (name: string) => {
      const p = players.find((x) => x.name === name)!
      return allRoleFits(p.attributes, p.positions, DEFAULT_ROLES, W)
    }
    // A centre-back's best natural role should be a centre-back role
    const cb = fit('Marin Pongračić').find((f) => f.natural)!
    expect(cb.role.positions).toContain('D (C)')
    // A goalkeeper only gets goalkeeper roles among his natural ones
    expect(
      fit('Luca Lezzerini')
        .filter((f) => f.natural)
        .every((f) => f.role.positions.includes('GK')),
    ).toBe(true)
  })
})
