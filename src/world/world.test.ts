import { describe, expect, it } from 'vitest'
import { DEFAULT_REGIONS } from '../data/regions'
import type { Dump } from '../import/dump'
import sample from '../import/fixtures/dump-sample.json'
import { buildWorld, nationKey, regionLookup, rowToPlayer, searchKey } from './world'

const dump = sample as unknown as Dump

describe('world file', () => {
  it('stores every player as a compact row and expands it back', () => {
    const w = buildWorld(dump)
    expect(w.rows).toHaveLength(dump.players.length)
    const row = w.rows.find((r) => r[1] === 'Franco Mastantuono')!
    const p = rowToPlayer(w, row)
    expect(p).toMatchObject({
      id: 2000183231,
      club: 'A.C.F. Fiorentina',
      positions: 'AM (RC)',
      ca: 141,
      pa: 180,
      nation: 'Argentina',
    })
    expect(p.attributes).toMatchObject({ Dribbling: 17, 'Team Work': 11 })
    expect(p.hidden.Consistency).toBe(12)
  })
})

describe('placeholder players', () => {
  it('leaves out clubless people with an unset reputation and unreadable names', () => {
    const base = dump.players[0]
    const w = buildWorld({
      ...dump,
      players: [
        { ...base, id: 1, name: '?', club: undefined, worldRep: 65535 } as never,
        { ...base, id: 2, name: 'Free Agent', club: undefined, worldRep: 1200 } as never,
        { ...base, id: 3, name: 'Real Player', club: 'Some FC', worldRep: 65535 } as never,
      ],
    })
    expect(w.rows.map((r) => r[0])).toEqual([2, 3])
  })
})

describe('nations and regions', () => {
  const region = regionLookup(DEFAULT_REGIONS)
  it('matches the dump spellings to region countries', () => {
    expect(region('Bosnia & Herzegovina')).toBe('southern-europe')
    expect(region('St. Barthélemy')).toBe('caribbean')
    expect(region('Bahamas')).toBe('caribbean')
    expect(region('Ireland')).toBe('uk-ireland')
    expect(region('UAE')).toBe('middle-east')
    expect(region('Timor-Leste')).toBe('south-east-asia')
    expect(region('Saint-Martin')).toBe('caribbean')
    expect(region('Italy')).toBe('southern-europe')
    expect(region('Atlantis')).toBeNull()
  })

  it('builds loose keys', () => {
    expect(nationKey('Trinidad & Tobago')).toBe(nationKey('Trinidad and Tobago'))
    expect(searchKey('Pongračić')).toBe('pongracic')
  })
})
