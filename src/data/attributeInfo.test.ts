import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_GROUPS, classifyHeader } from '../import/fields'
import fixture from '../import/fixtures/squad-attributes.html?raw'
import { parseHtmlTable } from '../import/parse'
import { ATTRIBUTE_INFO, PROFILE_LAYOUT, TABLE_LAYOUT, isGoalkeeper } from './attributeInfo'

describe('attribute layouts', () => {
  it('outfield table order matches the FM squad attributes view', () => {
    const exported = parseHtmlTable(fixture)
      .headers.map(classifyHeader)
      .flatMap((t) => (t.kind === 'attribute' ? [t.name] : []))
    expect(TABLE_LAYOUT.outfield.flatMap((s) => s.attributes)).toEqual(exported)
  })

  it('every attribute has an abbreviation and description', () => {
    const all = Object.values(ATTRIBUTE_GROUPS).flat()
    for (const name of all) {
      expect(ATTRIBUTE_INFO[name]?.abbr, name).toBeTruthy()
      expect(ATTRIBUTE_INFO[name]?.description, name).toBeTruthy()
    }
    const used = [...Object.values(TABLE_LAYOUT), ...Object.values(PROFILE_LAYOUT)].flatMap((l) =>
      l.flatMap((s) => s.attributes),
    )
    for (const name of used) expect(ATTRIBUTE_INFO[name], name).toBeDefined()
  })

  it('detects goalkeepers', () => {
    expect(isGoalkeeper('GK')).toBe(true)
    expect(isGoalkeeper('D (C)')).toBe(false)
    expect(isGoalkeeper(null)).toBe(false)
  })
})
