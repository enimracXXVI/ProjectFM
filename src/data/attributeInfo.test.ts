import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_GROUPS } from '../import/fields'
import fixture from '../import/fixtures/squad-attributes.json'
import {
  ATTRIBUTE_INFO,
  HIDDEN_INFO,
  HIDDEN_NAMES,
  PROFILE_COLUMNS,
  isGoalkeeper,
} from './attributeInfo'
import { tableSections } from './config'

describe('attribute layouts', () => {
  it('outfield table order matches the FM squad attributes view', () => {
    const exported = fixture.attributeOrder
    const shown = tableSections(PROFILE_COLUMNS, 'outfield').flatMap((s) => s.attributes)
    // Hidden values have their own column after FM's three
    expect(shown.filter((a) => !HIDDEN_NAMES.has(a))).toEqual(exported)
    expect(shown.slice(-HIDDEN_NAMES.size)).toEqual([...HIDDEN_NAMES])
  })

  it('every attribute has an abbreviation and description', () => {
    const all = Object.values(ATTRIBUTE_GROUPS).flat()
    for (const name of all) {
      expect(ATTRIBUTE_INFO[name]?.abbr, name).toBeTruthy()
      expect(ATTRIBUTE_INFO[name]?.description, name).toBeTruthy()
    }
    const used = Object.values(PROFILE_COLUMNS).flatMap((l) =>
      l.flat().flatMap((s) => s.attributes),
    )
    for (const name of used) expect(ATTRIBUTE_INFO[name] ?? HIDDEN_INFO[name], name).toBeDefined()
  })

  it('goalkeeper layout matches the FM keeper profile', () => {
    expect(tableSections(PROFILE_COLUMNS, 'goalkeepers').map((s) => s.label)).toEqual([
      'Goalkeeping',
      'Mental',
      'Physical',
      'Technical',
      'Hidden',
    ])
    expect(tableSections(PROFILE_COLUMNS, 'goalkeepers').at(-2)!.attributes).toEqual([
      'Free Kick Taking',
      'Penalty Taking',
      'Technique',
    ])
  })

  it('detects goalkeepers', () => {
    expect(isGoalkeeper('GK')).toBe(true)
    expect(isGoalkeeper('D (C)')).toBe(false)
    expect(isGoalkeeper(null)).toBe(false)
  })
})
