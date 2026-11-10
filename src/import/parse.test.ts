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

describe('other FM views', () => {
  it('reads the contract view into extra fields', async () => {
    const { default: html } = await import('./fixtures/squad-contract.html?raw')
    const r = parsePlayers(html)
    const pote = r.players.find((p) => p.name === 'Pote')!
    expect(pote.fm_uid).toBe(29192705)
    expect(pote.extra).toMatchObject({
      Wage: '€2.84M p/a',
      Expires: '30/6/2030',
      'Transfer Value': '€71M - €86M',
      'Minimum Fee Release Clause': '€80,000,000',
      'Playing Time': 'Important Player',
    })
    expect(pote.extra['Sell On Fee Percentage']).toBeUndefined()
  })

  it('keeps 3-letter nation codes apart from the full nation name', async () => {
    const { default: html } = await import('./fixtures/squad-stats.html?raw')
    const r = parsePlayers(html)
    const p = r.players.find((x) => x.name === 'Franco Mastantuono')!
    expect(p.nation).toBeNull()
    expect(p.extra['Nation code']).toBe('ARG')
    expect(p.extra).toMatchObject({ Apps: '0', 'xG/90': '0.00', Ability: '3.5', Potential: '5.0' })
    expect(p.extra.Rating).toBeUndefined()
    expect(r.columns.find((c) => c.header === 'Nation')!.target).toEqual({
      kind: 'extra',
      key: 'Nation code',
    })
    expect(r.warnings[0]).toMatch(/Unique ID/)
  })
})
