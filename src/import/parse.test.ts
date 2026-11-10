import { describe, expect, it } from 'vitest'
import fixture from './fixtures/squad-attributes.html?raw'
import { ImportError, parsePlayers } from './parse'

describe('parsePlayers with FM View Exporter squad file', () => {
  const result = parsePlayers(fixture)

  it('detects the view type and reads every row', () => {
    expect(result.table.viewType).toBe('squad')
    expect(result.players).toHaveLength(25)
    expect(result.warnings).toEqual([])
  })

  it('maps profile fields', () => {
    const p = result.players.find((x) => x.fm_uid === 91175664)!
    expect(p).toMatchObject({
      name: 'Marin Pongračić',
      positions: 'D (C)',
      squad_number: 5,
      age: 28,
      nation: 'Croatia',
      second_nation: 'Germany',
      height_cm: 193,
      left_foot: 'Reasonable',
      right_foot: 'Very Strong',
      personality: 'Balanced',
    })
  })

  it('decodes HTML entities in names', () => {
    expect(result.players.map((p) => p.name)).toContain('Álex Jiménez')
  })

  it('maps attributes by canonical name', () => {
    const p = result.players.find((x) => x.name === 'Franco Mastantuono')!
    expect(p.attributes).toMatchObject({ Dribbling: 17, Flair: 18, 'Team Work': 11, Pace: 13 })
    expect(Object.keys(p.attributes)).toHaveLength(36)
  })

  it('keeps selection and status flags in extra', () => {
    const p = result.players.find((x) => x.name === 'Fabiano Parisi')!
    expect(p.extra).toEqual({ status: 'Inj' })
    const gk = result.players.find((x) => x.name === 'Luca Lezzerini')!
    expect(gk.extra).toEqual({ selection: 'GK' })
  })

  it('treats "-" as empty', () => {
    const p = result.players.find((x) => x.name === 'Federico Matarán')!
    expect(p.squad_number).toBeNull()
  })
})

describe('parsePlayers edge cases', () => {
  const page = (head: string, row: string) =>
    `<html><body><table><tr>${head}</tr><tr>${row}</tr></table></body></html>`

  it('reads attribute ranges from partly scouted players', () => {
    const r = parsePlayers(
      page(
        '<th>Name</th><th>Pace</th><th>Flair</th>',
        '<td>X</td><td>11-14</td><td data-s="9|12">9-12</td>',
      ),
    )
    expect(r.players[0].attributes).toEqual({ Pace: [11, 14], Flair: [9, 12] })
  })

  it('warns when Unique ID is missing', () => {
    const r = parsePlayers(page('<th>Name</th>', '<td>X</td>'))
    expect(r.warnings[0]).toMatch(/Unique ID/)
  })

  it('rejects files without a table or name column', () => {
    expect(() => parsePlayers('<p>hi</p>')).toThrow(ImportError)
    expect(() => parsePlayers(page('<th>Age</th>', '<td>20</td>'))).toThrow(/Player/)
  })
})
