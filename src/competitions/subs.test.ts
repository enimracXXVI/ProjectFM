import { describe, expect, it } from 'vitest'
import { pairSubs } from './subs'
import type { ReportPlayer } from './types'

const p = (name: string, on: number | null, off: number | null, pos: string | null = null) =>
  ({ name, start: on === null, on, off, pos }) as ReportPlayer

describe('opponent substitutions', () => {
  // Atalanta at Fiorentina, 6 Sep 2026: positions as the save records them, pairs as FM shows
  const atalanta = [
    p('Odilon Kossounou', null, 52, 'DR'),
    p('Davide Zappacosta', null, 52, 'DL'),
    p('Mario Pašalić', null, 87, 'MC'),
    p('Lazar Samardžić', null, 52, 'MC'),
    p('Gianluca Scamacca', null, 58, 'ST'),
    p('Lorenzo Bernasconi', 52, null, 'DL'),
    p('Gianluca Gaetano', 52, null, 'DM'),
    p('Raoul Bellanova', 52, null, 'DR'),
    p('Giacomo Raspadori', 87, null, 'ST'),
    p('Nikola Krstović', 58, null, 'ST'),
  ]
  const by = (list: ReturnType<typeof pairSubs>, n: string) => list.find((x) => x.name === n)!

  it('pairs every change as FM did, by position then by elimination', () => {
    const out = pairSubs(atalanta)
    expect(by(out, 'Lorenzo Bernasconi').for).toBe('Davide Zappacosta')
    expect(by(out, 'Raoul Bellanova').for).toBe('Odilon Kossounou')
    expect(by(out, 'Gianluca Gaetano').for).toBe('Lazar Samardžić')
    expect(by(out, 'Nikola Krstović').for).toBe('Gianluca Scamacca')
    expect(by(out, 'Mario Pašalić').replacedBy).toBe('Giacomo Raspadori')
  })

  it('without positions, leaves changes made together unpaired', () => {
    const out = pairSubs(atalanta.map((x) => ({ ...x, pos: null })))
    expect(by(out, 'Nikola Krstović').for).toBe('Gianluca Scamacca')
    expect(by(out, 'Lorenzo Bernasconi').for).toBeUndefined()
    expect(by(out, 'Lorenzo Bernasconi').together).toEqual([
      'Odilon Kossounou',
      'Davide Zappacosta',
      'Lazar Samardžić',
    ])
  })

  it('keeps the pairs the save has (your own team)', () => {
    const own = [
      { ...p('A', null, 60), replacedBy: 'B' },
      { ...p('B', 60, null), for: 'A' },
    ]
    expect(pairSubs(own)).toBe(own)
  })
})
