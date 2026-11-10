import { describe, expect, it } from 'vitest'
import {
  addSection,
  hiddenAttributes,
  moveAttribute,
  moveSection,
  placeAttribute,
  removeSection,
  type Columns,
} from './layoutOps'

const cols: Columns = [
  [
    { label: 'A', attributes: ['x', 'y'] },
    { label: 'B', attributes: ['z'] },
  ],
  [{ label: 'C', attributes: [] }],
]

describe('layout operations', () => {
  it('reorders attributes within a section', () => {
    expect(moveAttribute(cols, 0, 0, 1, -1)[0][0].attributes).toEqual(['y', 'x'])
    expect(moveAttribute(cols, 0, 0, 0, -1)[0][0].attributes).toEqual(['x', 'y'])
  })

  it('moves an attribute to another section or hides it', () => {
    const moved = placeAttribute(cols, 'x', { col: 1, sec: 0 })
    expect(moved[0][0].attributes).toEqual(['y'])
    expect(moved[1][0].attributes).toEqual(['x'])
    const hidden = placeAttribute(cols, 'z', 'hidden')
    expect(hiddenAttributes(hidden, ['x', 'y', 'z', 'w'])).toEqual(['z', 'w'])
  })

  it('moves sections within and across columns', () => {
    expect(moveSection(cols, 0, 1, 'up')[0].map((s) => s.label)).toEqual(['B', 'A'])
    const right = moveSection(cols, 0, 0, 'right')
    expect(right[0].map((s) => s.label)).toEqual(['B'])
    expect(right[1].map((s) => s.label)).toEqual(['C', 'A'])
  })

  it('adds and removes sections without touching the original', () => {
    expect(addSection(cols, 1)[1]).toHaveLength(2)
    expect(removeSection(cols, 0, 0)[0].map((s) => s.label)).toEqual(['B'])
    expect(cols[0]).toHaveLength(2)
  })
})
