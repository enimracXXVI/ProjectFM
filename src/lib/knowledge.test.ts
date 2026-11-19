import { describe, expect, it } from 'vitest'
import { knowledgeLevel, knowledgeMins, labelKnowledge } from './knowledge'

const levels = [
  'Minimal',
  'Basic',
  'Average',
  'Above Average',
  'Very Good',
  'Extensive',
  'Exceptional',
  'Outstanding',
  'Complete',
]

describe('knowledge ranges', () => {
  it('starts each level at the lowest value seen in FM, the first at 0', () => {
    const mins = knowledgeMins(levels, [], { '5': 'Basic', '4': 'Minimal' })
    expect(mins[0]).toBe(0)
    expect(mins[levels.indexOf('Basic')]).toBe(5)
    expect(mins[levels.indexOf('Very Good')]).toBe(30)
  })
  it('gives a value the level whose range holds it', () => {
    const mins = knowledgeMins(levels, [], { '5': 'Basic' })
    expect(knowledgeLevel(3, levels, mins)).toBe(levels[0])
    expect(knowledgeLevel(7, levels, mins)).toBe('Basic')
    expect(knowledgeLevel(40, levels, mins)).toBe('Very Good')
    expect(labelKnowledge('Unknown (55)', levels, mins)).toBe('Extensive (55)')
  })
  it('uses saved starts when there is one per level', () => {
    const saved = levels.map((_, i) => i * 10)
    expect(knowledgeMins(levels, saved, {})).toEqual(saved)
    expect(knowledgeLevel(25, levels, saved)).toBe(levels[2])
  })
})
