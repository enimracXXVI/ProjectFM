import { describe, expect, it } from 'vitest'
import { pairSubs } from './subs'
import type { ReportPlayer } from './types'

const p = (name: string, start: boolean, on: number | null, off: number | null) =>
  ({ name, start, on, off }) as ReportPlayer

describe('opponent substitutions', () => {
  // Atalanta at Fiorentina, 6 Sep 2026 (checked in FM)
  const atalanta = [
    p('Odilon Kossounou', true, null, 52),
    p('Davide Zappacosta', true, null, 52),
    p('Mario Pašalić', true, null, 87),
    p('Lazar Samardžić', true, null, 52),
    p('Gianluca Scamacca', true, null, 58),
    p('Lorenzo Bernasconi', false, 52, null),
    p('Gianluca Gaetano', false, 52, null),
    p('Raoul Bellanova', false, 52, null),
    p('Giacomo Raspadori', false, 87, null),
    p('Nikola Krstović', false, 58, null),
  ]
  const out = pairSubs(atalanta)
  const by = (n: string) => out.find((x) => x.name === n)!

  it('pairs changes alone at their minute', () => {
    expect(by('Nikola Krstović').for).toBe('Gianluca Scamacca')
    expect(by('Mario Pašalić').replacedBy).toBe('Giacomo Raspadori')
  })

  it('leaves changes made together unpaired, listing the others', () => {
    expect(by('Lorenzo Bernasconi').for).toBeUndefined()
    expect(by('Lorenzo Bernasconi').together).toEqual([
      'Odilon Kossounou',
      'Davide Zappacosta',
      'Lazar Samardžić',
    ])
  })

  it('keeps the pairs the save has (your own team)', () => {
    const own = [
      { ...p('A', true, null, 60), replacedBy: 'B' },
      { ...p('B', false, 60, null), for: 'A' },
    ]
    expect(pairSubs(own)).toBe(own)
  })
})
