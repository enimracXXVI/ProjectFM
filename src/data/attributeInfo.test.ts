import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_GROUPS } from '../import/fields'
import fixture from '../import/fixtures/squad-attributes.json'
import { ATTRIBUTE_INFO, PROFILE_COLUMNS, isGoalkeeper } from './attributeInfo'
import { tableSections } from './config'

describe('attribute layouts', () => {
  it('outfield table order matches the FM squad attributes view', () => {
    const exported = fixture.attributeOrder
    expect(tableSections(PROFILE_COLUMNS, 'outfield').flatMap((s) => s.attributes)).toEqual(
      exported,
    )
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
    for (const name of used) expect(ATTRIBUTE_INFO[name], name).toBeDefined()
  })

  it('goalkeeper layout matches the FM keeper profile', () => {
    expect(tableSections(PROFILE_COLUMNS, 'goalkeepers').map((s) => s.label)).toEqual([
      'Goalkeeping',
      'Mental',
      'Physical',
      'Technical',
    ])
    expect(tableSections(PROFILE_COLUMNS, 'goalkeepers').at(-1)!.attributes).toEqual([
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
