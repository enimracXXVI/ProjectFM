import { describe, expect, it } from 'vitest'
import { byLastName, guessLastName, shortName } from './names'

describe('names', () => {
  it('guesses last names with particles', () => {
    expect(guessLastName('David De Gea')).toBe('De Gea')
    expect(guessLastName('Virgil van Dijk')).toBe('van Dijk')
    expect(guessLastName('Franco Mastantuono')).toBe('Mastantuono')
    expect(guessLastName('Pote')).toBe('Pote')
  })

  it('uses the save’s nickname and last name when known', () => {
    expect(
      shortName({ name: 'Pote', extra: { 'Common name': 'Pote', 'Last name': 'Gonçalves' } }),
    ).toBe('Pote')
    expect(shortName({ name: 'Christ Inao Oulaï', extra: { 'Last name': 'Inao Oulaï' } })).toBe(
      'Inao Oulaï',
    )
  })

  it('sorts by last name', () => {
    const names = ['Franco Mastantuono', 'David De Gea', 'Álex Jiménez', 'Pote'].map((name) => ({
      name,
    }))
    expect(names.sort(byLastName).map((p) => p.name)).toEqual([
      'David De Gea',
      'Álex Jiménez',
      'Franco Mastantuono',
      'Pote',
    ])
  })
})

describe('world names', () => {
  it('sorts world rows by the save’s last name or nickname', async () => {
    const { byLastNameParts } = await import('./names')
    const rows = [
      { name: 'Pote', lastName: 'Gonçalves', commonName: 'Pote' },
      { name: 'David De Gea', lastName: 'De Gea', commonName: null },
      { name: 'Christ Inao Oulaï', lastName: 'Inao Oulaï', commonName: null },
    ]
    expect(rows.sort(byLastNameParts).map((r) => r.name)).toEqual([
      'David De Gea',
      'Christ Inao Oulaï',
      'Pote',
    ])
  })
})
